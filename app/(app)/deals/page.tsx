import { getUser } from '@/lib/auth/get-user';
import { regionScope } from '@/lib/db/region-scope';
import { RegionSwitcher } from '@/components/app/region-switcher';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { PipelineKanban } from './_components/pipeline-kanban';
import { formatDealValue } from '@/lib/db/deals';

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const { profile } = await getUser();
  const canDelete = profile.role === 'super_admin' || profile.role === 'admin';
  const supabase = await createClient();
  const { regions, activeRegionId } = await regionScope(supabase, profile, region ?? null);

  // Filtered through the ACCOUNT rather than the deal. deals_with_stage is a
  // view built before regions existed, and a view's column list is fixed when
  // it is created - so region_id is not in it even though deals.region_id
  // exists. accounts!inner gives the same answer without a migration, and
  // 058's cascade keeps a deal's region equal to its account's. account_id is
  // NOT NULL, so the inner join drops nothing.
  const dealQuery = supabase
    .from('deals_with_stage')
    .select(`
      *,
      account:accounts!inner(id, name, vertical, region_id),
      contact:contacts!deals_primary_contact_id_fkey(id, first_name, last_name),
      owner:profiles!deals_owner_id_fkey(id, full_name, email)
    `)
    .order('stage_position').order('value_cents', { ascending: false });

  const [{ data: deals }, { data: stages }] = await Promise.all([
    activeRegionId ? dealQuery.eq('account.region_id', activeRegionId) : dealQuery,
    supabase.from('pipeline_stages').select('*').order('position'),
  ]);

  const dealList = deals || [];
  const stageList = stages || [];

  const totalValue = dealList
    .filter(d => !d.stage_is_won && !d.stage_is_lost)
    .reduce((sum, d) => sum + (d.value_cents || 0), 0);

  const openCount = dealList.filter(d => !d.stage_is_won && !d.stage_is_lost).length;

  return (
    <div className="p-4 md:p-8 max-w-[1800px]">
      <PageHeader
        kicker={`${openCount} open · ${formatDealValue(totalValue)} pipeline`}
        title="Sales"
        highlight="Pipeline"
        description="Drag deals between stages on desktop. Tap a deal to change stage on mobile."
        action={
          <Link href="/deals/new">
            <Button className="font-display tracking-wider btn-glow">+ Add</Button>
          </Link>
        }
      />

      {regions.length > 1 && (
        <div className="mb-3">
          <RegionSwitcher regions={regions} activeId={activeRegionId} basePath="/deals" allowAll />
        </div>
      )}

      {dealList.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No deals yet"
          description="A deal is one shop going somewhere. Most get created for you when you book a demo in Call Mode, so you rarely start here. Add what they are getting, sign the agreement, then invoice - a deal reaches LIVE when the invoice is paid."
          action={
            <Link href="/deals/new">
              <Button className="font-display tracking-wider">+ Add Deal</Button>
            </Link>
          }
        />
      ) : (
        <PipelineKanban initialDeals={dealList} stages={stageList} canDelete={canDelete} />
      )}
    </div>
  );
}
