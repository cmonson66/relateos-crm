import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { regionScope } from '@/lib/db/region-scope';
import { RegionSwitcher } from '@/components/app/region-switcher';
import { CalendarView, type CalEvent, type CalMode } from './_components/week-view';

export const dynamic = 'force-dynamic';

const DAY_MS = 86400000;
const PHX_MS = 7 * 3600000; // Phoenix = UTC-7, no DST
const TZ = 'America/Phoenix';

// All ranges are anchored to PHOENIX days: a "day" starts at 07:00 UTC.
function phxToday(): { y: number; m: number; d: number } {
  const p = new Date(Date.now() - PHX_MS);
  return { y: p.getUTCFullYear(), m: p.getUTCMonth(), d: p.getUTCDate() };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; o?: string; w?: string; d?: string; region?: string }>;
}) {
  const sp = await searchParams;
  const view: CalMode = sp.v === 'day' || sp.v === 'month' ? sp.v : 'week';
  const offset = Number(sp.o ?? sp.w ?? '0') || 0; // w= kept for old links
  const { y, m, d } = phxToday();

  let startMs: number;
  let numDays: number;
  let label: string;
  let focusMonth: number | null = null;

  if (view === 'day') {
    if (sp.d) {
      const [dy, dm, dd] = sp.d.split('-').map(Number);
      startMs = Date.UTC(dy, dm - 1, dd, 7);
    } else {
      startMs = Date.UTC(y, m, d + offset, 7);
    }
    numDays = 1;
    label = new Date(startMs).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ,
    });
  } else if (view === 'month') {
    const firstMs = Date.UTC(y, m + offset, 1, 7);
    const first = new Date(firstMs);
    focusMonth = first.getUTCMonth();
    const pad = (first.getUTCDay() + 6) % 7; // Monday-start
    startMs = firstMs - pad * DAY_MS;
    const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), focusMonth + 1, 0)).getUTCDate();
    numDays = Math.ceil((pad + daysInMonth) / 7) * 7;
    label = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: TZ });
  } else {
    const todayMs = Date.UTC(y, m, d, 7);
    const dow = (new Date(todayMs).getUTCDay() + 6) % 7;
    startMs = todayMs - dow * DAY_MS + offset * 7 * DAY_MS;
    numDays = 7;
    const endD = new Date(startMs + 6 * DAY_MS);
    label =
      new Date(startMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }) +
      ' – ' + endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });
  }

  const rangeStart = new Date(startMs).toISOString();
  const rangeEnd = new Date(startMs + numDays * DAY_MS).toISOString();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { profile } = await getUser();
  const { regions, activeRegionId } = await regionScope(supabase, profile, sp.region ?? null);

  // Activities carry no region of their own - they belong to whoever booked
  // them - so the region is applied through the OWNER. Corporate profiles
  // have no region and stay visible in every view, since they book calls
  // anywhere.
  const { data: regionPeople } = activeRegionId
    ? await supabase.from('profiles').select('id').eq('region_id', activeRegionId)
    : { data: null };
  const regionOwnerIds = regionPeople?.map((p) => p.id as string) ?? null;

  // RLS scopes this: reps see their book, super_admin sees everyone
  const activityQuery = supabase
    .from('activities')
    .select('id, type, subject, scheduled_at, completed_at, owner_id, account:accounts(id, name, city)')
    .gte('scheduled_at', rangeStart)
    .lt('scheduled_at', rangeEnd)
    .order('scheduled_at', { ascending: true });

  const { data: rows } = regionOwnerIds
    ? await activityQuery.in('owner_id', regionOwnerIds)
    : await activityQuery;

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, region_id');
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

  return (
    <>
      {regions.length > 1 && (
        <div className="px-4 pt-4 md:px-8">
          <RegionSwitcher regions={regions} activeId={activeRegionId} basePath="/calendar" allowAll />
        </div>
      )}
      <CalendarView
        events={events}
        view={view}
        rangeStartIso={rangeStart}
        numDays={numDays}
        label={label}
        offset={offset}
        focusMonth={focusMonth}
      />
    </>
  );
}
