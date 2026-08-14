'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Server actions RETURN their failures rather than throwing. Next strips the
// message off anything thrown out of a server action in production, so a
// readable reason ("that code is already taken") would reach the user as
// "An error occurred in the Server Components render".
export type ActionResult = { ok: true } | { ok: false; message: string };

async function requireAdmin(needSuper = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase
    .from('profiles').select('role, org_id').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    throw new Error('Admin access required');
  }
  // Opening a market is a different decision from tuning one. 067 enforces
  // this in RLS as well; this check exists so the refusal is a sentence
  // rather than a silent zero-row insert.
  if (needSuper && profile.role !== 'super_admin') {
    throw new Error('Only a super admin can open a new region.');
  }
  return { supabase, orgId: profile.org_id as string, role: profile.role as string };
}

function clean(v: string | undefined | null): string {
  return (v ?? '').trim();
}

export async function createRegion(input: {
  name: string;
  code: string;
  timezone: string;
  send_hour: number;
  agenda_hour: number;
}): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await requireAdmin(true);
    const name = clean(input.name);
    const code = clean(input.code).toUpperCase();
    if (!name) return { ok: false, message: 'Give the region a name.' };
    if (!/^[A-Z0-9]{2,8}$/.test(code)) {
      return { ok: false, message: 'Code must be 2 to 8 letters or numbers, like DFW.' };
    }

    const { error } = await supabase.from('regions').insert({
      org_id: orgId,
      name,
      code,
      timezone: clean(input.timezone) || 'America/Phoenix',
      send_hour: input.send_hour,
      agenda_hour: input.agenda_hour,
    });
    if (error) {
      if (error.code === '23505') return { ok: false, message: `A region already uses the code ${code}.` };
      if (error.code === '42501') {
        return { ok: false, message: 'Only a super admin can open a new region.' };
      }
      // The 058 trigger raises this by name when the zone is not real
      if (error.message.includes('Unknown IANA timezone')) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: error.message };
    }

    revalidatePath('/regions');
    revalidatePath('/campaigns');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not create the region.' };
  }
}

export async function updateRegion(
  id: string,
  updates: { name?: string; timezone?: string; send_hour?: number; agenda_hour?: number; is_active?: boolean },
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();

    // Deactivating the last active region would stop every campaign and every
    // agenda with no visible cause. Refuse by name instead.
    if (updates.is_active === false) {
      const { data: actives } = await supabase.from('regions').select('id').eq('is_active', true);
      if ((actives ?? []).length <= 1) {
        return { ok: false, message: 'That is the only active region. Add another before turning this one off.' };
      }
    }

    const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (typeof updates.name === 'string') patch.name = clean(updates.name);

    const { error } = await supabase.from('regions').update(patch).eq('id', id);
    if (error) {
      if (error.message.includes('Unknown IANA timezone')) return { ok: false, message: error.message };
      return { ok: false, message: error.message };
    }

    revalidatePath('/regions');
    revalidatePath('/campaigns');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not save the region.' };
  }
}
