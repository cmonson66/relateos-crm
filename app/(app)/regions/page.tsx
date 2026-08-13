import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { RegionsManager, type RegionCard } from './_components/regions-manager';

export const dynamic = 'force-dynamic';

export default async function RegionsPage() {
  const { profile } = await getUser();
  if (profile.role !== 'super_admin' && profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  const { data: regionRows } = await supabase
    .from('regions')
    .select('id, name, code, timezone, send_hour, agenda_hour, is_active')
    .eq('org_id', profile.org_id)
    .order('created_at');

  const regions = regionRows ?? [];
  const ids = regions.map((r) => r.id);

  // Counts come back per region rather than as one grouped query, because
  // PostgREST has no GROUP BY. head:true means only the count crosses the
  // wire. Leads go through the same path as everything else that reads
  // nectarpay_leads from the app: it is closed to app users, so a direct
  // count returns zero rather than an error - hence the RPC.
  const [people, accounts, campaigns] = await Promise.all([
    supabase.from('profiles').select('id, region_id').eq('is_active', true).in('region_id', ids),
    supabase.from('accounts').select('id, region_id').in('region_id', ids),
    supabase.from('campaign_settings').select('region_id, status').in('region_id', ids),
  ]);
  const { data: leadCounts } = await supabase.rpc('get_region_lead_counts');

  const tally = (rows: { region_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.region_id) m.set(r.region_id, (m.get(r.region_id) ?? 0) + 1);
    return m;
  };
  const peopleBy = tally(people.data);
  const accountsBy = tally(accounts.data);
  const statusBy = new Map(
    (campaigns.data ?? []).map((c) => [c.region_id as string, c.status as 'running' | 'paused'])
  );
  const leadsBy = new Map<string, number>(
    Object.entries((leadCounts ?? {}) as Record<string, number>)
  );

  const cards: RegionCard[] = regions.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    timezone: r.timezone,
    send_hour: r.send_hour,
    agenda_hour: r.agenda_hour,
    is_active: r.is_active,
    people: peopleBy.get(r.id) ?? 0,
    accounts: accountsBy.get(r.id) ?? 0,
    leads: leadsBy.get(r.id) ?? 0,
    campaign_status: statusBy.get(r.id) ?? null,
  }));

  return (
    <div className="p-4 md:p-8 max-w-[1100px]">
      <PageHeader
        kicker="Territory"
        title="Regions"
        highlight=""
        description="A region owns its own leads, its own team, and its own campaign on its own clock."
      />
      {cards.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No regions yet - run migration 058, then reload.
        </p>
      ) : (
        <RegionsManager regions={cards} />
      )}
    </div>
  );
}
