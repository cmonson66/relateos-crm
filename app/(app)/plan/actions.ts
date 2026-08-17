'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { DEFAULT_TZ, type TimeZone } from '@/lib/db/tz';
import { buildPlanFor } from '@/lib/planner/generate';

// Failures are RETURNED, never thrown. Next strips the message off anything
// thrown out of a server action in production.
export type ActionResult = { ok: true; planId?: string } | { ok: false; message: string };

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id, region_id, role, full_name')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('No profile');

  let tz: TimeZone = DEFAULT_TZ;
  if (profile.region_id) {
    const { data } = await supabase
      .from('regions').select('timezone').eq('id', profile.region_id).maybeSingle();
    if (data?.timezone) tz = data.timezone as TimeZone;
  }
  return { supabase, profile, tz };
}

/**
 * Builds today's plan and replaces any existing one for the same date.
 *
 * Replace rather than merge on purpose: a rep taps Replan when the day has
 * changed under them, and quietly keeping yesterday's reasoning around is how
 * a plan starts lying. Anything already marked done is preserved.
 */
/** The rep's own "Plan my day". The work happens in lib/planner/generate. */
export async function generatePlan(): Promise<ActionResult> {
  try {
    const { supabase, profile, tz } = await me();
    const res = await buildPlanFor(supabase, profile, tz);
    if (!res.ok) return res;
    revalidatePath('/plan');
    return { ok: true, planId: res.planId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not build the plan.' };
  }
}

export async function setItemState(
  itemId: string,
  state: 'pending' | 'done' | 'skipped',
  outcome?: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    // .select() so we can tell "updated" from "matched nothing". Without it a
    // PostgREST update blocked by RLS or a missing grant returns no error and
    // no rows, the action reports success, and the item just sits there -
    // which is indistinguishable from a hung request.
    const { data, error } = await supabase
      .from('day_plan_items')
      .update({ state, outcome: outcome ?? null, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select('id');
    if (error) return { ok: false, message: error.message };
    if (!data || data.length === 0) {
      return { ok: false, message: 'That item did not update. It may belong to another day.' };
    }
    revalidatePath('/plan');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not update that.' };
  }
}
