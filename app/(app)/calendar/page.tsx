import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { regionScope } from '@/lib/db/region-scope';
import { RegionSwitcher } from '@/components/app/region-switcher';
import { CalendarView, type CalEvent, type CalMode } from './_components/week-view';

export const dynamic = 'force-dynamic';

import { addDays, dayStartUtc, formatDateIn, todayIn, type TimeZone } from '@/lib/db/tz';

// Ranges are anchored to the VIEWER'S region. This used to assume a day
// starts at 07:00 UTC, which is only true in Phoenix - a Dallas rep saw their
// appointments laid out on Arizona grid lines, two hours off, and anything
// booked in that window landed in the wrong column.
//
// Days are built by CALENDAR arithmetic on YYYY-MM-DD rather than by adding
// 86,400,000 ms. On the two DST change days a local day is 23 or 25 hours
// long, so millisecond stepping drifts an hour and eventually a column.

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; o?: string; w?: string; d?: string; region?: string }>;
}) {
  const sp = await searchParams;
  const view: CalMode = sp.v === 'day' || sp.v === 'month' ? sp.v : 'week';
  const offset = Number(sp.o ?? sp.w ?? '0') || 0; // w= kept for old links

  const supabase = await createClient();
  const { profile } = await getUser();
  const { regions, activeRegionId, timezone } = await regionScope(supabase, profile, sp.region ?? null);
  const TZ: TimeZone = timezone;

  /** Weekday of a plain date, Monday = 0. No zone involved, just the day. */
  const mondayIndex = (ymd: string) => {
    const [yy, mm, dd] = ymd.split('-').map(Number);
    return (new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay() + 6) % 7;
  };

  const today = todayIn(TZ);
  let startYmd: string;
  let numDays: number;
  let label: string;
  let focusMonth: number | null = null;

  if (view === 'day') {
    startYmd = sp.d ?? addDays(today, offset);
    numDays = 1;
    label = new Date(dayStartUtc(startYmd, TZ)).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ,
    });
  } else if (view === 'month') {
    const [ty, tm] = today.split('-').map(Number);
    const target = new Date(Date.UTC(ty, tm - 1 + offset, 1));
    const firstYmd = target.toISOString().slice(0, 10);
    focusMonth = target.getUTCMonth();
    const pad = mondayIndex(firstYmd);
    startYmd = addDays(firstYmd, -pad);
    const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), focusMonth + 1, 0)).getUTCDate();
    numDays = Math.ceil((pad + daysInMonth) / 7) * 7;
    label = new Date(dayStartUtc(firstYmd, TZ)).toLocaleDateString('en-US', {
      month: 'long', year: 'numeric', timeZone: TZ,
    });
  } else {
    startYmd = addDays(today, -mondayIndex(today) + offset * 7);
    numDays = 7;
    label =
      formatDateIn(dayStartUtc(startYmd, TZ), TZ).replace(/,? \d{4}$/, '') +
      ' - ' +
      formatDateIn(dayStartUtc(addDays(startYmd, 6), TZ), TZ).replace(/,? \d{4}$/, '');
  }

  // Half-open local bounds. Built from the day AFTER the last one rather than
  // by adding numDays * 86,400,000, so a 23 or 25 hour DST day cannot shift
  // the window off the grid it is drawing.
  const rangeStart = dayStartUtc(startYmd, TZ);
  const rangeEnd = dayStartUtc(addDays(startYmd, numDays), TZ);
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        timezone={TZ}
        numDays={numDays}
        label={label}
        offset={offset}
        focusMonth={focusMonth}
      />
    </>
  );
}
