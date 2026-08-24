import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { PageHeader } from '@/components/app/page-header';
import { todayIn, dayBoundsUtc, DEFAULT_TZ, type TimeZone } from '@/lib/db/tz';
import { PlanView, type PlanItemView, type Appointment } from './_components/plan-view';
import { RunsPanel, type ActiveRun, type ActiveStop } from './_components/runs-panel';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  // The rep's own clock. A Dallas rep's morning is not Phoenix's.
  let tz: TimeZone = DEFAULT_TZ;
  if (profile.region_id) {
    const { data } = await supabase
      .from('regions').select('timezone').eq('id', profile.region_id).maybeSingle();
    if (data?.timezone) tz = data.timezone as TimeZone;
  }
  const planDate = todayIn(tz);

  const { data: plan } = await supabase
    .from('day_plans')
    .select('id, generated_at')
    .eq('profile_id', profile.id)
    .eq('plan_date', planDate)
    .maybeSingle();

  let calls: PlanItemView[] = [];
  let sends: PlanItemView[] = [];

  if (plan) {
    const { data: rows } = await supabase
      .from('day_plan_items')
      .select(
        'id, kind, account_id, contact_id, reason, est_minutes, state, sequence, ' +
          'account:accounts(id, name, city)',
      )
      .eq('plan_id', plan.id)
      .order('sequence', { ascending: true });

    // day_plans and day_plan_items are new in 068, so the generated database
    // types do not know them yet and PostgREST widens the row to an error
    // shape. Cast once, here, rather than sprinkling non-null assertions.
    const raw = (rows ?? []) as unknown as Record<string, unknown>[];
    const mapped: PlanItemView[] = raw.map((r) => {
      const a = (Array.isArray(r.account) ? r.account[0] : r.account) as
        | { id: string; name: string; city: string | null }
        | undefined;
      return {
        id: r.id as string,
        kind: r.kind as PlanItemView['kind'],
        accountId: (r.account_id as string) ?? null,
        contactId: (r.contact_id as string) ?? null,
        accountName: (a?.name as string) ?? 'Account',
        city: (a?.city as string) ?? null,
        phone: null,
        reason: r.reason as string,
        estMinutes: (r.est_minutes as number) ?? 6,
        state: r.state as PlanItemView['state'],
      };
    });
    calls = mapped.filter((m) => m.kind === 'call');
    sends = mapped.filter((m) => m.kind === 'send');
  }

  // Today's meetings are the field block. Read-only in phase 1 - they anchor
  // the day, and the corridor walk-ins that hang off them come next.
  const { startIso, endIso } = dayBoundsUtc(planDate, tz);
  const { data: meetings } = await supabase
    .from('activities')
    .select('id, subject, scheduled_at, account_id, account:accounts(id, name, city)')
    .eq('owner_id', profile.id)
    .eq('type', 'meeting')
    .is('completed_at', null)
    .gte('scheduled_at', startIso)
    .lt('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true });

  const appointments: Appointment[] = (meetings ?? []).map((m) => {
    const a = Array.isArray(m.account) ? m.account[0] : m.account;
    return {
      id: m.id as string,
      accountId: (m.account_id as string) ?? null,
      accountName: (a?.name as string) ?? 'Account',
      city: (a?.city as string) ?? null,
      at: m.scheduled_at as string,
      subject: (m.subject as string) ?? 'Visit',
    };
  });

  // A run in progress replaces the offers - a rep walking 83rd Ave does not
  // want three more suggestions.
  const { data: runRow } = await supabase
    .from('day_runs')
    .select('id, label, est_minutes, day_run_stops(id, account_id, sequence, state, account:accounts(id, name, city, tags, vertical, latitude, longitude))')
    .eq('profile_id', profile.id)
    .eq('plan_date', planDate)
    .eq('state', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeRun: ActiveRun | null = null;
  if (runRow) {
    const raw = runRow as unknown as Record<string, unknown>;
    const stops = ((raw.day_run_stops ?? []) as Record<string, unknown>[])
      .sort((a, b) => (a.sequence as number) - (b.sequence as number))
      .map((s): ActiveStop => {
        const a = (Array.isArray(s.account) ? s.account[0] : s.account) as
          | { id: string; name: string; city: string | null; tags: string[]; vertical: string; latitude: number | null; longitude: number | null }
          | undefined;
        const tags = a?.tags ?? [];
        return {
          id: s.id as string,
          accountId: s.account_id as string,
          name: a?.name ?? 'Shop',
          city: a?.city ?? null,
          band: tags.find((t) => t === 'HOT' || t === 'WARM' || t === 'COOL') ?? 'COOL',
          vertical: a?.vertical ?? '',
          lat: a?.latitude ?? null,
          lng: a?.longitude ?? null,
          state: s.state as ActiveStop['state'],
        };
      });
    activeRun = {
      id: raw.id as string,
      label: raw.label as string,
      estMinutes: (raw.est_minutes as number) ?? 0,
      stops,
    };
  }

  const firstName = (profile.full_name ?? 'there').split(' ')[0];
  const label = new Date(`${planDate}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="p-4 md:p-8 max-w-[900px]">
      <PageHeader
        kicker={`${label} · ${firstName}`}
        title="The"
        highlight="Morning"
        description="Worked top to bottom. Every one says why it is there."
      />
      <div className="mt-6">
        <PlanView
          calls={calls}
          sends={sends}
          appointments={appointments}
          generatedAt={(plan?.generated_at as string) ?? null}
          timezone={tz}
          firstName={firstName}
        />

        <div className="mt-4">
          <RunsPanel active={activeRun} />
        </div>
      </div>
    </div>
  );
}
