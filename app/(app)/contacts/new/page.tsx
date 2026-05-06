import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { ContactForm } from '../_components/contact-form';

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name')
    .order('name');

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader kicker="New record" title="Add" highlight="Contact" />
      <ContactForm accounts={accounts || []} defaultAccountId={params.account || undefined} />
    </div>
  );
}
