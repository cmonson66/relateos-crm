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
  // Pre-bind when arriving from an account page; otherwise the form's
  // search picker handles the 28K (the old fetch-everything Select was
  // silently capped at 1,000 rows - it never got past the A's)
  const { data: boundAccount } = params.account
    ? await supabase.from('accounts').select('id, name').eq('id', params.account).maybeSingle()
    : { data: null };

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader kicker="New record" title="Add" highlight="Contact" />
      <ContactForm initialAccount={boundAccount} />
    </div>
  );
}
