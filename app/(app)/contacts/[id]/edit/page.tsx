import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { ContactForm } from '../../_components/contact-form';

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contact } = await supabase.from('contacts').select('*').eq('id', id).single();
  if (!contact) notFound();
  const { data: currentAccount } = contact.account_id
    ? await supabase.from('accounts').select('id, name').eq('id', contact.account_id).maybeSingle()
    : { data: null };

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader kicker={`Editing · ${contact.first_name} ${contact.last_name || ''}`} title="Edit" highlight="Contact" />
      <ContactForm existing={contact} initialAccount={currentAccount} />
    </div>
  );
}
