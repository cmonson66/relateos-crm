'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit } from '@/lib/db/audit';

export type AccountFormData = {
  name: string;
  vertical: 'corporate' | 'sports' | 'public_safety' | 'military' | 'education' | 'other';
  website?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  tags?: string[];
};

export async function createAccount(data: AccountFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('No profile');

  const { data: created, error } = await supabase
    .from('accounts')
    .insert({
      ...data,
      org_id: profile.org_id,
      created_by: user.id,
      owner_id: user.id,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await logAudit({ entityType: 'account', entityId: created.id, action: 'created' });
  revalidatePath('/accounts');
  redirect(`/accounts/${created.id}`);
}

export async function updateAccount(id: string, data: Partial<AccountFormData>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('accounts')
    .update(data)
    .eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'account', entityId: id, action: 'updated' });
  revalidatePath(`/accounts/${id}`);
  revalidatePath('/accounts');
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'account', entityId: id, action: 'deleted' });
  revalidatePath('/accounts');
  redirect('/accounts');
}
