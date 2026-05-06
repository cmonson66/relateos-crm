import { notFound } from 'next/navigation';
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
  const [{ data: deal }, { data: accounts }, { data: contacts }, { data: stages }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', id).single(),
    supabase.from('accounts').select('id, name').order('name'),
    supabase.from('contacts').select('id, first_name, last_name, account_id').order('first_name'),
    supabase.from('pipeline_stages').select('*').order('position'),
  ]);
  if (!deal) notFound();

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader kicker={`Editing · ${deal.name}`} title="Edit" highlight="Deal" />
      <DealForm
        existing={deal}
        accounts={accounts || []}
        contacts={contacts || []}
        stages={stages || []}
      />
    </div>
  );
}
