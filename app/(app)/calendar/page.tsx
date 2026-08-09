import { createClient } from '@/lib/supabase/server';
import { WeekView, type CalEvent } from './_components/week-view';

export const dynamic = 'force-dynamic';

const DAY_MS = 86400000;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const offset = Number(w ?? '0') || 0;

  // Anchor the week to PHOENIX days (UTC-7, no DST). The server runs in
  // UTC - anchoring to its local "today" put the grid a day ahead every
  // evening, so bookings for "tomorrow" fell past the last visible column.
  const PHX_MS = 7 * 3600000;
  const phx = new Date(Date.now() - PHX_MS);
  const dow = (phx.getUTCDay() + 6) % 7; // Mon=0, in Phoenix terms
  const mondayUtcMs = Date.UTC(
    phx.getUTCFullYear(), phx.getUTCMonth(),
    phx.getUTCDate() - dow + offset * 7,
    7, 0, 0 // Phoenix midnight = 07:00 UTC
  );
  const weekStart = new Date(mondayUtcMs).toISOString();
  const weekEnd = new Date(mondayUtcMs + 7 * DAY_MS).toISOString();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS scopes this: reps see their book, super_admin sees everyone
  const { data: rows } = await supabase
    .from('activities')
    .select('id, type, subject, scheduled_at, completed_at, owner_id, account:accounts(id, name, city)')
    .gte('scheduled_at', weekStart)
    .lt('scheduled_at', weekEnd)
    .order('scheduled_at', { ascending: true });

  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name?.split(' ')[0] ?? '']));

  const events: CalEvent[] = (rows ?? []).map((r) => {
    const acct = Array.isArray(r.account) ? r.account[0] : r.account;
    return {
      id: r.id,
      type: r.type,
      subject: r.subject ?? '',
      at: r.scheduled_at as string,
      done: !!r.completed_at,
      mine: r.owner_id === user?.id,
      owner: nameById.get(r.owner_id) ?? '',
      accountId: acct?.id ?? null,
      accountName: acct?.name ?? '(no account)',
      city: acct?.city ?? '',
    };
  });

  return <WeekView events={events} weekStartIso={weekStart} offset={offset} />;
}
