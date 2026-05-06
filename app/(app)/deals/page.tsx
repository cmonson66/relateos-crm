import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { PipelineKanban } from './_components/pipeline-kanban';
import { formatDealValue } from '@/lib/db/deals';

export default async function DealsPage() {
  await getUser();
  const supabase = await createClient();

  const [{ data: deals }, { data: stages }] = await Promise.all([
    supabase
      .from('deals_with_stage')
      .select(`
        *,
        account:accounts(id, name, vertical),
        contact:contacts!deals_primary_contact_id_fkey(id, first_name, last_name),
        owner:profiles!deals_owner_id_fkey(id, full_name, email)
      `)
      .order('stage_position').order('value_cents', { ascending: false }),
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

      {dealList.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No deals yet"
          description="Create your first deal to start tracking your pipeline."
          action={
            <Link href="/deals/new">
              <Button className="font-display tracking-wider">+ Add Deal</Button>
            </Link>
          }
        />
      ) : (
        <PipelineKanban initialDeals={dealList} stages={stageList} />
      )}
    </div>
  );
}
