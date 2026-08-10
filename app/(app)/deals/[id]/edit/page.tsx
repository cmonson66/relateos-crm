import { notFound } from 'next/navigation';
import { BackLink } from '@/components/app/back-link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { DealForm } from '../../_components/deal-form';

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: deal }, { data: stages }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', id).single(),
    supabase.from('pipeline_stages').select('*').order('position'),
  ]);
  if (!deal) notFound();

  // Only the deal's own account + its contacts (the org-wide fetches this
  // replaced were capped at 1,000 rows)
  const [{ data: boundAccount }, { data: contacts }] = await Promise.all([
    deal.account_id
      ? supabase.from('accounts').select('id, name').eq('id', deal.account_id).maybeSingle()
      : Promise.resolve({ data: null }),
    deal.account_id
      ? supabase.from('contacts').select('id, first_name, last_name, account_id').eq('account_id', deal.account_id).order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <BackLink fallbackHref="/deals" fallbackLabel="All deals" />

      <PageHeader kicker={`Editing · ${deal.name}`} title="Edit" highlight="Deal" />
      <DealForm
        existing={deal}
        initialAccount={boundAccount}
        contacts={contacts || []}
        stages={stages || []}
      />
    </div>
  );
}
