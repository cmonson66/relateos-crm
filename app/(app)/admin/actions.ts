'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/db/audit';

export type UserUpdate = {
  role?: 'super_admin' | 'admin' | 'manager' | 'rep';
  manager_id?: string | null;
  is_active?: boolean;
  full_name?: string;
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase
    .from('profiles').select('role, org_id').eq('id', user.id).single();
  if (!profile) throw new Error('No profile');
  if (profile.role !== 'super_admin' && profile.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return { supabase, currentUserId: user.id, currentRole: profile.role, orgId: profile.org_id };
}

export async function updateUser(targetId: string, updates: UserUpdate) {
  const { supabase, currentUserId, currentRole } = await requireAdmin();

  // Don't allow editing yourself in ways that lock you out
  if (targetId === currentUserId && updates.role && updates.role !== currentRole) {
    throw new Error("You can't change your own role");
  }
  if (targetId === currentUserId && updates.is_active === false) {
    throw new Error("You can't deactivate yourself");
  }

  // Only super_admin can promote to super_admin
  if (updates.role === 'super_admin' && currentRole !== 'super_admin') {
    throw new Error('Only super admins can grant super admin role');
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', targetId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}
