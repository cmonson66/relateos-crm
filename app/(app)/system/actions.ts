'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function setLockStatus(params: {
  status: 'active' | 'read_only' | 'locked';
  message?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles').select('role, org_id').eq('id', user.id).single();
  if (!profile || profile.role !== 'super_admin') {
    throw new Error('Super admin access required');
  }

  const updates: {
    lock_status: 'active' | 'read_only' | 'locked';
    lock_message: string | null;
    locked_at: string | null;
    locked_by: string | null;
  } = {
    lock_status: params.status,
    lock_message: params.status === 'active' ? null : (params.message || null),
    locked_at: params.status === 'active' ? null : new Date().toISOString(),
    locked_by: params.status === 'active' ? null : user.id,
  };

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', profile.org_id);

  if (error) throw new Error(error.message);

  revalidatePath('/system');
}
