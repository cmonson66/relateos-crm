'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export type UserUpdate = {
  role?: 'super_admin' | 'admin' | 'manager' | 'rep';
  manager_id?: string | null;
  /** NULL keeps someone corporate: no region limit, sees every region. */
  region_id?: string | null;
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

async function requireAdminOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase
    .from('profiles').select('role, org_id').eq('id', user.id).single();
  if (!profile) throw new Error('No profile');
  if (!['super_admin', 'admin', 'manager'].includes(profile.role)) {
    throw new Error('Admin or manager access required');
  }
  return { supabase, currentUserId: user.id, currentRole: profile.role, orgId: profile.org_id };
}

export async function updateUser(targetId: string, updates: UserUpdate) {
  const { supabase, currentUserId, currentRole } = await requireAdmin();

  if (targetId === currentUserId && updates.role && updates.role !== currentRole) {
    throw new Error("You can't change your own role");
  }
  if (targetId === currentUserId && updates.is_active === false) {
    throw new Error("You can't deactivate yourself");
  }
  if (updates.role === 'super_admin' && currentRole !== 'super_admin') {
    throw new Error('Only super admins can grant super admin role');
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', targetId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function generateInviteLink(params: {
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'manager' | 'rep';
  managerId?: string | null;
}): Promise<{ inviteUrl: string; email: string }> {
  const { orgId, currentRole } = await requireAdmin();

  if (params.role === 'super_admin' && currentRole !== 'super_admin') {
    throw new Error('Only super admins can invite super admins');
  }

  const email = params.email.trim().toLowerCase();
  if (!email.match(/^[^@]+@[^@]+\.[^@]+$/)) {
    throw new Error('Invalid email address');
  }

  const adminClient = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: {
        full_name: params.fullName.trim(),
        org_id: orgId,
        invited_role: params.role,
        invited_manager_id: params.managerId ?? null,
      },
      redirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.properties?.action_link) throw new Error('Failed to generate invite link');

  const { data: newUser } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (newUser) {
    await adminClient
      .from('profiles')
      .update({
        full_name: params.fullName.trim(),
        role: params.role,
        manager_id: params.managerId ?? null,
        org_id: orgId,
      })
      .eq('id', newUser.id);
  }

  revalidatePath('/admin');
  return { inviteUrl: data.properties.action_link, email };
}

export type DeletePreview = {
  targetEmail: string;
  targetName: string | null;
  accountsCount: number;
  contactsCount: number;
  dealsCount: number;
  activitiesCount: number;
  defaultSuccessorId: string | null;
  defaultSuccessorName: string | null;
};

export async function previewDeleteUser(targetId: string): Promise<DeletePreview> {
  const { supabase, currentUserId } = await requireAdminOrManager();

  if (targetId === currentUserId) {
    throw new Error('Cannot delete yourself');
  }

  // Fetch target details
  const { data: target } = await supabase
    .from('profiles')
    .select('id, email, full_name, manager_id')
    .eq('id', targetId)
    .single();

  if (!target) throw new Error('User not found');

  const [
    { count: accountsCount },
    { count: contactsCount },
    { count: dealsCount },
    { count: activitiesCount },
  ] = await Promise.all([
    supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
  ]);

  // Default successor: their manager, if any
  let defaultSuccessorId: string | null = null;
  let defaultSuccessorName: string | null = null;
  if (target.manager_id) {
    const { data: mgr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', target.manager_id)
      .single();
    if (mgr) {
      defaultSuccessorId = mgr.id;
      defaultSuccessorName = mgr.full_name || mgr.email;
    }
  }

  return {
    targetEmail: target.email,
    targetName: target.full_name,
    accountsCount: accountsCount ?? 0,
    contactsCount: contactsCount ?? 0,
    dealsCount: dealsCount ?? 0,
    activitiesCount: activitiesCount ?? 0,
    defaultSuccessorId,
    defaultSuccessorName,
  };
}

export async function deleteUser(params: {
  targetId: string;
  successorId: string;
  confirmEmail: string;
}): Promise<{ ok: true; reassigned: { accounts: number; contacts: number; deals: number; activities: number; comments: number } }> {
  const { supabase, currentUserId } = await requireAdminOrManager();

  if (params.targetId === currentUserId) {
    throw new Error("You can't delete yourself");
  }
  if (params.targetId === params.successorId) {
    throw new Error('Successor cannot be the user being deleted');
  }

  // Verify the typed-confirmation matches the target's email
  const { data: target } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', params.targetId)
    .single();
  if (!target) throw new Error('User not found');
  if (params.confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
    throw new Error('Email confirmation does not match');
  }

  // Call the SQL function — it does the authorization check, reassigns
  // ownership, audits the action, and deletes the profile.
  const { data, error } = await supabase.rpc('reassign_and_delete_user', {
    target_user_id: params.targetId,
    successor_user_id: params.successorId,
  });

  if (error) throw new Error(error.message);

  // Now remove the auth.users row using the service-role client
  const adminClient = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: authError } = await adminClient.auth.admin.deleteUser(params.targetId);
  if (authError) {
    // Profile is already deleted but auth.users remained — surface the error
    // so admin knows to check Supabase manually
    throw new Error(`Profile removed, but auth user removal failed: ${authError.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');

  return data as { ok: true; reassigned: { accounts: number; contacts: number; deals: number; activities: number; comments: number } };
}
