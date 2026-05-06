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
  const [{ data: contact }, { data: accounts }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase.from('accounts').select('id, name').order('name'),
  ]);
  if (!contact) notFound();

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader kicker={`Editing · ${contact.first_name} ${contact.last_name || ''}`} title="Edit" highlight="Contact" />
      <ContactForm existing={contact} accounts={accounts || []} />
    </div>
  );
}
