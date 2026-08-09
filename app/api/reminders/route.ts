import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Daily 7 AM Phoenix (14:00 UTC — Phoenix skips DST): each rep gets their
// day's agenda; each merchant with a booked visit today gets a reminder
// sent from their rep's identity. Mirrors the system-rules cron pattern.

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PHX_OFFSET_MS = 7 * 3600000; // UTC-7, no DST

function phoenixDayBoundsUtc(): { start: string; end: string } {
  const phxNow = new Date(Date.now() - PHX_OFFSET_MS);
  const start = Date.UTC(phxNow.getUTCFullYear(), phxNow.getUTCMonth(), phxNow.getUTCDate(), 7, 0, 0);
  return { start: new Date(start).toISOString(), end: new Date(start + 86400000).toISOString() };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Phoenix' });

async function sendEmail(from: string, to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY missing');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) console.error('resend:', res.status, await res.text());
  return res.ok;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { start, end } = phoenixDayBoundsUtc();

  const { data: rows, error } = await supabase
    .from('activities')
    .select('id, type, subject, scheduled_at, owner_id, account_id, contact_id, account:accounts(name, city)')
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .is('completed_at', null)
    .order('scheduled_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (rows ?? []).map((r) => {
    const acct = Array.isArray(r.account) ? r.account[0] : r.account;
    return { ...r, accountName: acct?.name ?? '', city: acct?.city ?? '' };
  });
  if (items.length === 0) return NextResponse.json({ ok: true, agenda: 0, merchant: 0 });

  // Identities
  const { data: profiles } = await supabase.from('profiles').select('id, email, full_name');
  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const { data: reps } = await supabase.from('reps').select('profile_id, first_name, from_email, cell, is_default');
  const repByProfile = new Map((reps ?? []).map((r) => [r.profile_id, r]));
  const defaultRep = (reps ?? []).find((r) => r.is_default) ?? { first_name: 'Eric', from_email: 'eric@nectarpayaz.com', cell: '' };

  let agendaSent = 0;
  let merchantSent = 0;

  // ---- rep agendas ----
  const byOwner = new Map<string, typeof items>();
  for (const it of items) byOwner.set(it.owner_id, [...(byOwner.get(it.owner_id) ?? []), it]);

  for (const [ownerId, list] of byOwner) {
    const prof = profById.get(ownerId);
    if (!prof?.email) continue;
    const first = (prof.full_name ?? 'there').split(' ')[0];
    const lines = list.map(
      (it) => `  ${fmtTime(it.scheduled_at)}  ${it.subject ?? it.type}  -  ${it.accountName}${it.city ? ` (${it.city})` : ''}`
    );
    const text = `${first},\n\nToday's schedule (${list.length}):\n\n${lines.join('\n')}\n\nGo get 'em.\n- NectarPay CRM`;
    if (await sendEmail('NectarPay CRM <crm@nectarpayaz.com>', prof.email, `Today: ${list.length} on the calendar`, text)) agendaSent++;
  }

  // ---- merchant reminders (booked visits only, when the lead has an email) ----
  const meetings = items.filter((it) => it.type === 'meeting' && it.contact_id);
  if (meetings.length > 0) {
    const contactIds = meetings.map((m) => m.contact_id as string);
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, legacy_id, first_name, title')
      .in('id', contactIds);
    const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));
    const legacyIds = (contacts ?? []).map((c) => c.legacy_id).filter(Boolean) as string[];
    const { data: leads } = legacyIds.length
      ? await supabase.from('nectarpay_leads').select('place_id, emails, status').in('place_id', legacyIds)
      : { data: [] as { place_id: string; emails: string[]; status: string }[] };
    const leadByPlace = new Map((leads ?? []).map((l) => [l.place_id, l]));

    for (const m of meetings) {
      const c = contactById.get(m.contact_id as string);
      const lead = c?.legacy_id ? leadByPlace.get(c.legacy_id) : null;
      const email = lead?.emails?.[0];
      if (!email || lead?.status === 'DNC') continue;
      const rep = repByProfile.get(m.owner_id) ?? defaultRep;
      const who = c && c.title !== 'Business' && c.first_name ? c.first_name : null;
      const text = `${who ? who + ',' : 'Hi,'}\n\n${rep.first_name} with NectarPay - just confirming I'll swing by ${m.accountName} today around ${fmtTime(m.scheduled_at)}. Ten minutes, you'll watch a live payment settle.\n\nNeed a different time? Text me: ${rep.cell || ''}\n\n- ${rep.first_name}`;
      if (
        await sendEmail(
          `${rep.first_name} at NectarPay <${rep.from_email}>`,
          email,
          `Still good for ${fmtTime(m.scheduled_at)} today?`,
          text
        )
      )
        merchantSent++;
    }
  }

  return NextResponse.json({ ok: true, items: items.length, agenda: agendaSent, merchant: merchantSent });
}
