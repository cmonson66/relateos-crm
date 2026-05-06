'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

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

  // Use service-role client for admin operations
  const adminClient = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Use generateLink with type 'invite' — creates a magic-link URL the admin
  // can paste into Slack/text/email. The user clicks it, lands on the auth
  // callback, gets logged in, and the handle_new_user trigger creates their
  // profile (which we then patch with role + manager).
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

  // The auth user now exists. Wait briefly for the handle_new_user trigger
  // to create the profile, then patch role + manager.
  // (Trigger runs synchronously inside the auth.users insert so it should
  // already be there — but we look it up by email to be safe.)
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
