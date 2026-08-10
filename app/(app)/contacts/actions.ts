'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit } from '@/lib/db/audit';

export type ContactFormData = {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  account_id?: string | null;
  lifecycle_stage: 'new' | 'working' | 'engaged' | 'customer' | 'disqualified';
  notes?: string | null;
  tags?: string[];
};

export async function createContact(data: ContactFormData) {
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
    .from('contacts')
    .insert({
      ...data,
      org_id: profile.org_id,
      created_by: user.id,
      owner_id: user.id,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'contact', entityId: created.id, action: 'created' });
  revalidatePath('/contacts');
  redirect(`/contacts/${created.id}`);
}

export async function updateContact(id: string, data: Partial<ContactFormData>) {
  const supabase = await createClient();
  const { error } = await supabase.from('contacts').update(data).eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'contact', entityId: id, action: 'updated' });
  revalidatePath(`/contacts/${id}`);
  revalidatePath('/contacts');
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'contact', entityId: id, action: 'deleted' });
  revalidatePath('/contacts');
  redirect('/contacts');
}


// Admin-only bulk delete for contacts (their activities go first).
export async function bulkDeleteContacts(contactIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: me } = await supabase
    .from('profiles').select('role, org_id').eq('id', user.id).single();
  if (!me || (me.role !== 'super_admin' && me.role !== 'admin')) {
    throw new Error('Only admins can bulk-delete');
  }
  if (contactIds.length === 0) return { contactsDeleted: 0 };

  const CHUNK = 200;
  let contactsDeleted = 0;
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const ids = contactIds.slice(i, i + CHUNK);
    await supabase.from('activities').delete().in('contact_id', ids);
    const { count, error } = await supabase
      .from('contacts').delete({ count: 'exact' }).eq('org_id', me.org_id).in('id', ids);
    if (error) throw new Error(error.message);
    contactsDeleted += count ?? 0;
  }

  await logAudit({ entityType: 'contact', entityId: contactIds[0], action: 'deleted' });
  revalidatePath('/contacts');
  revalidatePath('/accounts');
  return { contactsDeleted };
}
