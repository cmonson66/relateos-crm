'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit } from '@/lib/db/audit';

export type DealFormData = {
  name: string;
  account_id: string;
  primary_contact_id?: string | null;
  stage_id: string;
  value_cents?: number;
  expected_close_date?: string | null;
  notes?: string | null;
};

// Contacts for one account - the deal form used to receive EVERY contact
// in the org just to populate this dropdown
export async function contactsForAccount(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, account_id')
    .eq('account_id', accountId)
    .order('created_at');
  return data ?? [];
}

export async function createDeal(data: DealFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single();
  if (!profile) throw new Error('No profile');

  const { data: created, error } = await supabase
    .from('deals')
    .insert({
      ...data,
      org_id: profile.org_id,
      created_by: user.id,
      owner_id: user.id,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'deal', entityId: created.id, action: 'created' });
  revalidatePath('/deals');
  redirect(`/deals/${created.id}`);
}

export async function updateDealStage(dealId: string, stageId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('deals')
    .update({ stage_id: stageId })
    .eq('id', dealId);
  if (error) throw new Error(error.message);
  // Audit + notification handled by DB triggers
  revalidatePath('/deals');
  revalidatePath(`/deals/${dealId}`);
}

export async function updateDeal(id: string, data: Partial<DealFormData>) {
  const supabase = await createClient();
  const { error } = await supabase.from('deals').update(data).eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'deal', entityId: id, action: 'updated' });
  revalidatePath(`/deals/${id}`);
  revalidatePath('/deals');
}

export async function deleteDeal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'deal', entityId: id, action: 'deleted' });
  revalidatePath('/deals');
  redirect('/deals');
}


// Same delete, without the redirect - used by the X on a kanban card so
// the board just refreshes in place.
export async function deleteDealInline(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'deal', entityId: id, action: 'deleted' });
  revalidatePath('/deals');
  return { ok: true };
}
