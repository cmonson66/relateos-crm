import { createClient } from '@/lib/supabase/server';
import { BackLink } from '@/components/app/back-link';
import { PageHeader } from '@/components/app/page-header';
import { DealForm } from '../_components/deal-form';

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; contact?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Arriving from an account or contact page? Bind that account and load
  // only ITS contacts. (Fetching all accounts/contacts hit the 1,000-row
  // cap, which made a correctly prefilled account render blank.)
  let accountId = params.account ?? null;
  if (!accountId && params.contact) {
    const { data: c } = await supabase
      .from('contacts').select('account_id').eq('id', params.contact).maybeSingle();
    accountId = c?.account_id ?? null;
  }

  const [{ data: boundAccount }, { data: contacts }, { data: stages }] = await Promise.all([
    accountId
      ? supabase.from('accounts').select('id, name').eq('id', accountId).maybeSingle()
      : Promise.resolve({ data: null }),
    accountId
      ? supabase.from('contacts').select('id, first_name, last_name, account_id').eq('account_id', accountId).order('created_at')
      : Promise.resolve({ data: [] }),
    supabase.from('pipeline_stages').select('*').order('position'),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <BackLink fallbackHref="/deals" fallbackLabel="All deals" />

      <PageHeader kicker="New record" title="Add" highlight="Deal" />
      <DealForm
        initialAccount={boundAccount}
        contacts={contacts || []}
        stages={stages || []}
        defaultContactId={params.contact || undefined}
      />
    </div>
  );
}
