import type { SupabaseClient } from '@supabase/supabase-js';
import { todayIn, type TimeZone, DEFAULT_TZ } from '@/lib/db/tz';

/**
 * Marks today's plan item done when the rep actually does the thing.
 *
 * Without this the rep runs the call, logs the outcome, and the plan item is
 * still sitting there pending - so they have to come back and tick it. That
 * double bookkeeping is the single most reliable way to kill a feature like
 * this: the plan drifts out of sync with reality within an hour, and a plan
 * that lies gets closed.
 *
 * Deliberately best-effort. A planner bookkeeping failure must never take
 * down logging a call, which is the thing that actually matters.
 */
export async function completePlanItem(
  supabase: SupabaseClient,
  opts: {
    profileId: string;
    accountId: string | null;
    kind: 'call' | 'send';
    outcome?: string | null;
    tz?: TimeZone;
  },
): Promise<void> {
  if (!opts.accountId) return;
  try {
    const planDate = todayIn(opts.tz ?? DEFAULT_TZ);
    const { data: plan } = await supabase
      .from('day_plans')
      .select('id')
      .eq('profile_id', opts.profileId)
      .eq('plan_date', planDate)
      .maybeSingle();
    if (!plan) return;

    await supabase
      .from('day_plan_items')
      .update({
        state: 'done',
        outcome: opts.outcome ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('plan_id', plan.id)
      .eq('account_id', opts.accountId)
      .eq('kind', opts.kind)
      .eq('state', 'pending');
  } catch {
    // Swallowed on purpose. See above.
  }
}
