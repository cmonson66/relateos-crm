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
}): Promise<{ inviteUrl: string; email: string; userId: string | null }> {
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
  // The id is returned so the caller can finish the rep's sending identity -
  // the invite trigger creates them dormant with no alias.
  return { inviteUrl: data.properties.action_link, email, userId: newUser?.id ?? null };
}

/**
 * A fresh sign-in link for somebody who ALREADY has an account.
 *
 * Invite links are single use and short lived, and mail scanners eat them by
 * prefetching. Without this the only way back in was deleting the person and
 * recreating them, which churns their auth user, loses their id, and drags
 * every foreign key pointing at it along for the ride.
 *
 * Nothing is emailed. The link is returned so it can be texted, which also
 * means this keeps working when SMTP does not.
 */
export async function resendAccessLink(params: {
  email: string;
  kind?: 'magiclink' | 'recovery';
}): Promise<{ ok: true; url: string; email: string; setsPassword: boolean } | { ok: false; message: string }> {
  try {
    await requireAdmin();

    const email = params.email.trim().toLowerCase();

    const adminClient = createPlainClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, password_set_at')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      return { ok: false, message: 'No account with that email. Use Invite instead.' };
    }

    // Somebody who has never set a password needs a magic link - a recovery
    // link assumes there is a password to recover. Either way the callback
    // sends them to /welcome while password_set_at is null.
    const kind = params.kind ?? (profile.password_set_at ? 'recovery' : 'magiclink');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: kind,
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    });

    if (error) return { ok: false, message: error.message };
    if (!data?.properties?.action_link) {
      return { ok: false, message: 'Could not generate a link.' };
    }

    return {
      ok: true,
      url: data.properties.action_link,
      email,
      setsPassword: !profile.password_set_at,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not generate a link.' };
  }
}

/**
 * The half create_rep_identity() deliberately leaves undone.
 *
 * That trigger makes a rep row on invite with from_email null and active
 * false, on purpose - a rep with no working alias should be skipped by the
 * sender rather than emailing merchants from an address that bounces. But
 * nothing ever filled the alias in, so every rep sat dormant until somebody
 * remembered to write SQL. This is that step, in the UI.
 *
 * Setting an alias activates them. Clearing it puts them back to dormant,
 * which is the correct behaviour rather than an oversight.
 */
export async function setRepIdentity(params: {
  profileId: string;
  firstName?: string | null;
  fromEmail?: string | null;
  cell?: string | null;
}): Promise<{ ok: true; active: boolean } | { ok: false; message: string }> {
  try {
    const { supabase } = await requireAdmin();

    const fromEmail = params.fromEmail?.trim().toLowerCase() || null;
    if (fromEmail && !fromEmail.match(/^[^@]+@[^@]+\.[^@]+$/)) {
      return { ok: false, message: 'That sending address does not look like an email.' };
    }

    const { data: existing } = await supabase
      .from('reps')
      .select('profile_id, first_name, is_default')
      .eq('profile_id', params.profileId)
      .maybeSingle();

    // Never quietly deactivate the default sender - the campaign would have
    // no identity left to send from.
    if (existing?.is_default && !fromEmail) {
      return {
        ok: false,
        message: 'They are the default sender. Give somebody else that role before clearing their address.',
      };
    }

    const patch = {
      first_name: params.firstName?.trim() || existing?.first_name || null,
      from_email: fromEmail,
      cell: params.cell?.trim() || null,
      active: !!fromEmail,
    };

    const { error } = existing
      ? await supabase.from('reps').update(patch).eq('profile_id', params.profileId)
      : await supabase.from('reps').insert({ profile_id: params.profileId, ...patch, is_default: false });

    if (error) return { ok: false, message: error.message };

    revalidatePath('/admin');
    revalidatePath('/campaigns');
    return { ok: true, active: !!fromEmail };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not save that.' };
  }
}

export type DeletePreview = {
  targetEmail: string;
  targetName: string | null;
  accountsCount: number;
  contactsCount: number;
  dealsCount: number;
  activitiesCount: number;
  /** Hardware they are holding. It moves to the successor too. */
  terminalsCount: number;
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
    { count: terminalsCount },
  ] = await Promise.all([
    supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('owner_id', targetId),
    supabase.from('terminals').select('*', { count: 'exact', head: true }).eq('held_by_profile_id', targetId),
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
    terminalsCount: terminalsCount ?? 0,
    defaultSuccessorId,
    defaultSuccessorName,
  };
}

export async function deleteUser(params: {
  targetId: string;
  successorId: string;
  confirmEmail: string;
}): Promise<
  | { ok: true; reassigned: { accounts: number; contacts: number; deals: number; activities: number; comments: number } }
  | { ok: false; message: string }
> {
  // Failures are RETURNED. Next replaces anything THROWN out of a server
  // action with a generic "An error occurred in the Server Components render"
  // in production, so a thrown reason reaches the user as no reason at all.
  try {
  const { supabase, currentUserId } = await requireAdminOrManager();

  if (params.targetId === currentUserId) {
    return { ok: false, message: "You can't delete yourself" };
  }
  if (params.targetId === params.successorId) {
    return { ok: false, message: 'Successor cannot be the user being deleted' };
  }

  // Verify the typed-confirmation matches the target's email
  const { data: target } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', params.targetId)
    .single();
  if (!target) return { ok: false, message: 'User not found' };
  if (params.confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
    return { ok: false, message: 'Email confirmation does not match' };
  }

  // Everything the RPC does not know about, handled first.
  //
  // reassign_and_delete_user predates the terminals table (051), the reps
  // table and the per-region campaign settings, so it reassigns accounts,
  // contacts and deals and then hits a foreign key it has never heard of.
  // Clearing these here beats editing a function whose body has drifted.

  // Hardware follows the book. If Anthony leaves, Joe inherits the shops AND
  // the terminals in Anthony's trunk - somebody has to be accountable for a
  // $499 asset, and "nobody" is how one quietly stops existing.
  const { data: heldTerminals } = await supabase
    .from('terminals')
    .select('id, serial')
    .eq('held_by_profile_id', params.targetId);

  if ((heldTerminals ?? []).length > 0) {
    const { error: termErr } = await supabase
      .from('terminals')
      .update({ held_by_profile_id: params.successorId })
      .eq('held_by_profile_id', params.targetId);
    if (termErr) {
      return { ok: false, message: `Could not hand over their terminals: ${termErr.message}` };
    }
    // A serial should never change hands without the trail saying so.
    // Shape copied from the terminals actions: org_id is required and the
    // actor column is by_profile_id.
    const { data: me } = await supabase
      .from('profiles').select('org_id').eq('id', currentUserId).single();
    if (me?.org_id) {
      await supabase.from('terminal_events').insert(
        (heldTerminals ?? []).map((t) => ({
          org_id: me.org_id as string,
          terminal_id: t.id as string,
          event: 'note',
          note: `Handed over from ${target.email} on account deletion`,
          by_profile_id: currentUserId,
        })),
      );
    }
  }

  // A deleted person cannot be the campaign's sending identity. Null it and
  // the engine falls back to the default rep.
  const { data: sendingFor } = await supabase
    .from('campaign_settings')
    .select('region_id')
    .eq('send_owner_id', params.targetId);
  if ((sendingFor ?? []).length > 0) {
    await supabase
      .from('campaign_settings')
      .update({ send_owner_id: null })
      .eq('send_owner_id', params.targetId);
  }

  // Their rep record goes with them - but not if they are the default sender,
  // because that would leave the campaign with no identity to send from.
  const { data: repRow } = await supabase
    .from('reps')
    .select('profile_id, is_default')
    .eq('profile_id', params.targetId)
    .maybeSingle();
  if (repRow) {
    if (repRow.is_default) {
      return {
        ok: false,
        message:
          'They are the default sending rep. Make somebody else the default on the campaign settings first, then delete.',
      };
    }
    const { error: repErr } = await supabase.from('reps').delete().eq('profile_id', params.targetId);
    if (repErr) return { ok: false, message: `Could not remove their rep record: ${repErr.message}` };
  }

  // Call the SQL function — it does the authorization check, reassigns
  // ownership, audits the action, and deletes the profile.
  const { data, error } = await supabase.rpc('reassign_and_delete_user', {
    target_user_id: params.targetId,
    successor_user_id: params.successorId,
  });

  if (error) return { ok: false, message: error.message };

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
    return { ok: false, message: `Profile removed, but auth user removal failed: ${authError.message}` };
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');

  return data as { ok: true; reassigned: { accounts: number; contacts: number; deals: number; activities: number; comments: number } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Delete failed' };
  }
}
