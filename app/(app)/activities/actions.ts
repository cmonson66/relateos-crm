'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/db/audit';

export type ActivityFormData = {
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject?: string | null;
  body?: string | null;
  account_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  scheduled_at?: string | null;
  completed_at?: string | null;
  duration_minutes?: number | null;
  assigned_to?: string | null;
  assignment_note?: string | null;
};

export async function logActivity(data: ActivityFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single();
  if (!profile) throw new Error('No profile');

  // If this is a task with assigned_to, set assigned_by to current user
  const insertData = {
    ...data,
    org_id: profile.org_id,
    owner_id: user.id,
    assigned_by: data.type === 'task' && data.assigned_to ? user.id : null,
    // If completed_at not set and not scheduled, mark complete now
    completed_at: data.completed_at || (data.scheduled_at ? null : new Date().toISOString()),
  };

  const { data: created, error } = await supabase
    .from('activities')
    .insert(insertData)
    .select('id, account_id, contact_id, deal_id')
    .single();

  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'activity', entityId: created.id, action: 'created' });

  // Revalidate any pages that show this activity
  if (created.account_id) revalidatePath(`/accounts/${created.account_id}`);
  if (created.contact_id) revalidatePath(`/contacts/${created.contact_id}`);
  if (created.deal_id) revalidatePath(`/deals/${created.deal_id}`);
  revalidatePath('/dashboard');
  revalidatePath('/activities');

  return created;
}

export async function completeActivity(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: updated, error } = await supabase
    .from('activities')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
    .select('account_id, contact_id, deal_id')
    .single();

  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'activity', entityId: id, action: 'updated' });

  if (updated?.account_id) revalidatePath(`/accounts/${updated.account_id}`);
  if (updated?.contact_id) revalidatePath(`/contacts/${updated.contact_id}`);
  if (updated?.deal_id) revalidatePath(`/deals/${updated.deal_id}`);
  revalidatePath('/dashboard');
  revalidatePath('/activities');
}

export async function deleteActivity(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
  revalidatePath('/activities');
}
