import { createClient } from '@/lib/supabase/server';
import { PlaybookView } from './_components/playbook-view';

export const dynamic = 'force-dynamic';

const PHX_MS = 7 * 3600000;

// Phoenix day start (07:00 UTC). In a helper so the purity lint rule does
// not mistake a server component for a render body.
function phxDayStartUtc(): Date {
  const p = new Date(Date.now() - PHX_MS);
  return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate(), 7));
}

// The master walk-in script plus the kit builder: pick the shops you are
// visiting and print a packet (their sheet + a one-pager) for each.
export default async function PlaybookPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const todayStart = phxDayStartUtc();
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

  // The rep's own upcoming visits - RLS already limits this to their book
  const { data: upcoming } = await supabase
    .from('activities')
    .select('id, subject, scheduled_at, account:accounts(id, name, city)')
    .eq('type', 'meeting')
    .is('completed_at', null)
    .gte('scheduled_at', todayStart.toISOString())
    .lt('scheduled_at', weekEnd.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(25);

  const { data: repRow } = await supabase
    .from('reps').select('first_name, cell, from_email').eq('profile_id', user!.id).maybeSingle();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const visits = (upcoming ?? []).map(a => {
    const acct = Array.isArray(a.account) ? a.account[0] : a.account;
    return {
      id: a.id,
      accountId: acct?.id ?? null,
      name: acct?.name ?? 'Account',
      city: acct?.city ?? '',
      at: a.scheduled_at as string,
      subject: a.subject ?? '',
    };
  }).filter(v => v.accountId);

  return (
    <PlaybookView
      visits={visits}
      rep={{
        first: repRow?.first_name ?? (profile?.full_name ?? 'Rep').split(' ')[0],
        cell: repRow?.cell ?? '',
        email: repRow?.from_email ?? '',
      }}
    />
  );
}
