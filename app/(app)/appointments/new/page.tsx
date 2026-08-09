import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { QuickAppointment } from './_components/quick-appointment';

export const dynamic = 'force-dynamic';

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account: accountId } = await searchParams;
  if (!accountId) notFound();

  const supabase = await createClient();
  const { data: account } = await supabase
    .from('accounts')
    .select('id, name, city, state')
    .eq('id', accountId)
    .maybeSingle();
  if (!account) notFound();

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <QuickAppointment
      account={{ id: account.id, name: account.name, city: [account.city, account.state].filter(Boolean).join(', ') }}
      contactId={contact?.id ?? null}
    />
  );
}
