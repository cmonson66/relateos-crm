import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { AccountForm } from '../../_components/account-form';

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single();
  if (!account) notFound();

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader kicker={`Editing · ${account.name}`} title="Edit" highlight="Account" />
      <AccountForm existing={account} />
    </div>
  );
}
