'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit } from '@/lib/db/audit';
import { enrichAccount } from './enrich';

export type AccountFormData = {
  name: string;
  vertical: string; // per-instance values, see lib/verticals.ts
  website?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  tags?: string[];
  // Set by the address lookup on the form. Without coordinates a hand-added
  // account is invisible to the map and can never appear in a canvas run.
  address?: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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

  // Bridge to the leads layer: Places-match the business so the map pin,
  // band tags, and crypto density light up like any scraped lead.
  // Best-effort - a failed match must never block the create.
  try {
    await enrichAccount(created.id);
  } catch (e) {
    console.error('enrichAccount:', e);
  }

  revalidatePath('/accounts');
  redirect(`/accounts/${created.id}`);
}

/**
 * Failures are RETURNED, not thrown. Next replaces anything thrown out of a
 * server action with a generic "error occurred in the Server Components
 * render" in production, so a thrown reason reaches the user as no reason.
 */
export async function updateAccount(
  id: string,
  data: Partial<AccountFormData>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('accounts')
    .update(data)
    .eq('id', id);

  if (error) {
    // 071 made (org_id, place_id) unique, so re-pinning one shop to an
    // address another account already holds lands here. Say which one, so it
    // is obvious this is a duplicate rather than a broken save.
    if (error.code === '23505' && error.message.includes('place_id')) {
      const { data: other } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('place_id', data.place_id ?? '')
        .neq('id', id)
        .maybeSingle();
      return {
        ok: false,
        message: other
          ? `That address is already on "${other.name}". One shop, one account - open that one instead.`
          : 'That address is already on another account.',
      };
    }
    return { ok: false, message: error.message };
  }

  await logAudit({ entityType: 'account', entityId: id, action: 'updated' });
  revalidatePath(`/accounts/${id}`);
  revalidatePath('/accounts');
  return { ok: true };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logAudit({ entityType: 'account', entityId: id, action: 'deleted' });
  revalidatePath('/accounts');
  redirect('/accounts');
}

/**
 * Bulk-assign accounts to a rep — and cascade to their CONTACTS, because
 * the campaign sender and Pulse cards route off contacts.owner_id. Without
 * the cascade, assignment would look right in the CRM while emails kept
 * coming from the default rep.
 *
 * Admin/super_admin only. Chunked so 9K+ ids never hit one statement.
 */
export async function bulkAssignAccounts(accountIds: string[], newOwnerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: me } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single();
  if (!me || (me.role !== 'super_admin' && me.role !== 'admin')) {
    throw new Error('Only admins can bulk-assign');
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', newOwnerId)
    .eq('org_id', me.org_id)
    .eq('is_active', true)
    .single();
  if (!target) throw new Error('Rep not found');

  const CHUNK = 400;
  let accountsUpdated = 0;
  let contactsUpdated = 0;

  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const ids = accountIds.slice(i, i + CHUNK);

    const { error: accErr, count: accCount } = await supabase
      .from('accounts')
      .update({ owner_id: newOwnerId }, { count: 'exact' })
      .in('id', ids);
    if (accErr) throw new Error(`Accounts chunk failed: ${accErr.message}`);
    accountsUpdated += accCount ?? 0;

    const { error: conErr, count: conCount } = await supabase
      .from('contacts')
      .update({ owner_id: newOwnerId }, { count: 'exact' })
      .in('account_id', ids);
    if (conErr) throw new Error(`Contacts chunk failed: ${conErr.message}`);
    contactsUpdated += conCount ?? 0;
  }

  if (accountIds.length > 0) {
    await logAudit({ entityType: 'account', entityId: accountIds[0], action: 'updated' });
  }
  revalidatePath('/accounts');
  revalidatePath('/contacts');

  return { accountsUpdated, contactsUpdated };
}


// ---------------------------------------------------------------------
// Bulk delete. Admin-only, and deliberately unglamorous: dependent rows
// go first so nothing dangles, and everything is chunked so a big
// selection can't time out halfway and leave a mess.
// ---------------------------------------------------------------------
export async function bulkDeleteAccounts(accountIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: me } = await supabase
    .from('profiles').select('role, org_id').eq('id', user.id).single();
  if (!me || (me.role !== 'super_admin' && me.role !== 'admin')) {
    throw new Error('Only admins can bulk-delete');
  }
  if (accountIds.length === 0) return { accountsDeleted: 0, contactsDeleted: 0 };

  const CHUNK = 200;
  let accountsDeleted = 0;
  let contactsDeleted = 0;

  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const ids = accountIds.slice(i, i + CHUNK);

    // Contacts on these accounts (needed for their activities + the count)
    const { data: kids } = await supabase
      .from('contacts').select('id').in('account_id', ids);
    const contactIds = (kids ?? []).map(c => c.id);

    if (contactIds.length > 0) {
      await supabase.from('activities').delete().in('contact_id', contactIds);
    }
    await supabase.from('activities').delete().in('account_id', ids);
    await supabase.from('deals').delete().in('account_id', ids);

    const { count: cCount } = await supabase
      .from('contacts').delete({ count: 'exact' }).in('account_id', ids);
    contactsDeleted += cCount ?? 0;

    const { count: aCount, error } = await supabase
      .from('accounts').delete({ count: 'exact' }).eq('org_id', me.org_id).in('id', ids);
    if (error) throw new Error(error.message);
    accountsDeleted += aCount ?? 0;
  }

  await logAudit({ entityType: 'account', entityId: accountIds[0], action: 'deleted' });
  revalidatePath('/accounts');
  revalidatePath('/contacts');
  revalidatePath('/map');
  return { accountsDeleted, contactsDeleted };
}
