import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { DealForm } from '../_components/deal-form';

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; contact?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: accounts }, { data: contacts }, { data: stages }] = await Promise.all([
    supabase.from('accounts').select('id, name').order('name'),
    supabase.from('contacts').select('id, first_name, last_name, account_id').order('first_name'),
    supabase.from('pipeline_stages').select('*').order('position'),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader kicker="New record" title="Add" highlight="Deal" />
      <DealForm
        accounts={accounts || []}
        contacts={contacts || []}
        stages={stages || []}
        defaultAccountId={params.account || undefined}
        defaultContactId={params.contact || undefined}
      />
    </div>
  );
}
