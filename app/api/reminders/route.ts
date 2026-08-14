import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dayBoundsUtc, formatTimeIn, hourIn, todayIn, type TimeZone } from '@/lib/db/tz';
import { buildPlanFor } from '@/lib/planner/generate';

// Morning agendas and merchant visit reminders, now HOURLY (vercel.json).
//
// This used to run once at 14:00 UTC with the Phoenix offset hardcoded, which
// silently becomes 9 AM for a rep in Dallas - two hours after they have left
// for their first door. Now the cron wakes every hour and each region acts
// when its own clock reads its own agenda_hour, with regions.last_agenda_at
// (061) making sure that happens once per local day even if the cron replays.

export const maxDuration = 120;

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

type RegionRow = {
  id: string;
  org_id: string;
  code: string;
  timezone: TimeZone;
  agenda_hour: number;
  is_active: boolean;
  last_agenda_at: string | null;
};

type ActivityRow = {
  id: string;
  type: string;
  subject: string | null;
  scheduled_at: string;
  owner_id: string;
  account_id: string | null;
  contact_id: string | null;
  account: { name: string; city: string | null } | { name: string; city: string | null }[] | null;
};

async function runRegion(
  supabase: ReturnType<typeof createServiceClient>,
  region: RegionRow,
  ownerIds: string[],
): Promise<{ items: number; agenda: number; merchant: number; plans: number }> {
  const tz = region.timezone;
  const { startIso, endIso } = dayBoundsUtc(todayIn(tz), tz);
  const fmtTime = (iso: string) => formatTimeIn(iso, tz);

  if (ownerIds.length === 0) return { items: 0, agenda: 0, merchant: 0, plans: 0 };

  // Build each rep's day before the agenda email goes out, so the email can
  // point at a plan that already exists. Discovery was the real gap: a page
  // nobody knows to open is a page nobody opens.
  //
  // Under the service role there is no RLS, so buildPlanFor scopes every
  // query by owner_id itself. One rep's failure must not stop the others'.
  let plans = 0;
  for (const ownerId of ownerIds) {
    try {
      const { data: p } = await supabase
        .from('profiles').select('id, org_id, region_id').eq('id', ownerId).maybeSingle();
      if (!p) continue;
      const res = await buildPlanFor(supabase, p as { id: string; org_id: string; region_id: string | null }, tz);
      if (res.ok) plans++;
      else console.error('plan', ownerId, res.message);
    } catch (e) {
      console.error('plan', ownerId, e instanceof Error ? e.message : 'failed');
    }
  }

  const { data: rows, error } = await supabase
    .from('activities')
    .select('id, type, subject, scheduled_at, owner_id, account_id, contact_id, account:accounts(name, city)')
    .in('owner_id', ownerIds)
    .gte('scheduled_at', startIso)
    .lt('scheduled_at', endIso)
    .is('completed_at', null)
    .order('scheduled_at', { ascending: true });
  if (error) throw new Error(error.message);

  const items = ((rows ?? []) as ActivityRow[]).map((r) => {
    const acct = Array.isArray(r.account) ? r.account[0] : r.account;
    return { ...r, accountName: acct?.name ?? '', city: acct?.city ?? '' };
  });
  if (items.length === 0) return { items: 0, agenda: 0, merchant: 0, plans };

  const { data: profiles } = await supabase
    .from('profiles').select('id, email, full_name').in('id', ownerIds);
  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const { data: reps } = await supabase
    .from('reps').select('profile_id, first_name, from_email, cell, is_default');
  const repByProfile = new Map((reps ?? []).map((r) => [r.profile_id, r]));
  const defaultRep =
    (reps ?? []).find((r) => r.is_default) ??
    { first_name: 'Eric', from_email: 'eric@nectarpayaz.com', cell: '' };

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
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const planLine = appUrl
      ? `\n\nYour calls and sends for this morning are already ranked: ${appUrl}/plan`
      : '';
    const text = `${first},\n\nToday's schedule (${list.length}):\n\n${lines.join('\n')}${planLine}\n\nGo get 'em.\n- NectarPay CRM`;
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

  return { items: items.length, agenda: agendaSent, merchant: merchantSent, plans };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force');
  const supabase = createServiceClient();

  const { data: regionRows, error: regionErr } = await supabase
    .from('regions')
    .select('id, org_id, code, timezone, agenda_hour, is_active, last_agenda_at')
    .order('created_at');
  if (regionErr) return NextResponse.json({ error: regionErr.message }, { status: 500 });
  const regions = (regionRows ?? []) as RegionRow[];

  // Who belongs to which region. Corporate profiles have region_id NULL by
  // design, and they still book their own calls, so they ride along with their
  // org's OLDEST region rather than never receiving an agenda at all.
  const { data: people } = await supabase
    .from('profiles').select('id, org_id, region_id').eq('is_active', true);
  const firstRegionOfOrg = new Map<string, string>();
  for (const r of regions) if (!firstRegionOfOrg.has(r.org_id)) firstRegionOfOrg.set(r.org_id, r.id);

  const ownersByRegion = new Map<string, string[]>();
  for (const p of people ?? []) {
    const target = p.region_id ?? firstRegionOfOrg.get(p.org_id);
    if (!target) continue;
    ownersByRegion.set(target, [...(ownersByRegion.get(target) ?? []), p.id]);
  }

  const results: Record<string, unknown>[] = [];

  for (const region of regions) {
    const tag = region.code;
    if (!region.is_active) {
      results.push({ region: tag, skipped: 'region inactive' });
      continue;
    }

    const localHour = hourIn(region.timezone);
    const localDay = todayIn(region.timezone);
    const forced = force != null && force.toUpperCase() === tag.toUpperCase();

    if (!forced && localHour !== region.agenda_hour) {
      results.push({ region: tag, skipped: `local hour ${localHour}, agenda at ${region.agenda_hour}` });
      continue;
    }
    if (region.last_agenda_at && todayIn(region.timezone, new Date(region.last_agenda_at)) === localDay) {
      results.push({ region: tag, skipped: `already sent on ${localDay}` });
      continue;
    }

    try {
      const r = await runRegion(supabase, region, ownersByRegion.get(region.id) ?? []);
      // Stamped even on a zero-activity morning: the region HAS had its run,
      // and without the stamp every later hour would re-query all day.
      await supabase
        .from('regions')
        .update({ last_agenda_at: new Date().toISOString() })
        .eq('id', region.id);
      results.push({ region: tag, localDay, ...r });
    } catch (e) {
      results.push({ region: tag, error: e instanceof Error ? e.message : 'failed' });
    }
  }

  const ran = results.filter((r) => 'agenda' in r).length;
  return NextResponse.json({ ok: true, regions: results.length, ran, results });
}
