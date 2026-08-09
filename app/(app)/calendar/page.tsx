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

  // Monday-start week in local server time; client renders in Phoenix time
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Mon=0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + offset * 7);
  const weekStart = monday.toISOString();
  const weekEnd = new Date(monday.getTime() + 7 * DAY_MS).toISOString();

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
