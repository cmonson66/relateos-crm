'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { todayIn, dayBoundsUtc, DEFAULT_TZ, type TimeZone } from '@/lib/db/tz';
import { fetchAllRowsById } from '@/lib/db/fetch-all';
import {
  buildCallList,
  buildSendList,
  type PlannerAccount,
  type PlannerSignal,
  type PlannerCommitment,
} from '@/lib/planner/rank';

// Failures are RETURNED, never thrown. Next strips the message off anything
// thrown out of a server action in production.
export type ActionResult = { ok: true; planId?: string } | { ok: false; message: string };

const DEFAULT_CALL_BUDGET = 12;
const DEFAULT_SEND_BUDGET = 5;

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
export async function generatePlan(): Promise<ActionResult> {
  try {
    const { supabase, profile, tz } = await me();
    const now = Date.now();
    const planDate = todayIn(tz);

    // ---- the rep's own book ------------------------------------------------
    const accountRows = await fetchAllRowsById(() =>
      supabase
        .from('accounts')
        .select(
          'id, name, city, vertical, tags, last_activity_at, crypto_score, ' +
            'contacts(id, phone, email, legacy_id, title, created_at)',
        )
        .eq('owner_id', profile.id),
    );

    const accounts: PlannerAccount[] = (accountRows as unknown as Record<string, unknown>[]).map((a) => {
      const cs = (a.contacts ?? []) as { id: string; phone: string | null; email: string | null; legacy_id: string | null; title: string | null }[];
      // Prefer a real person over an import placeholder for the call.
      const c = cs.find((x) => x.title !== 'Business' && x.phone) ?? cs.find((x) => x.phone) ?? cs[0] ?? null;
      const tags = (a.tags ?? []) as string[];
      return {
        accountId: a.id as string,
        contactId: c?.id ?? null,
        name: a.name as string,
        city: (a.city as string) ?? null,
        vertical: (a.vertical as string) ?? '',
        band: tags.find((t) => t === 'HOT' || t === 'WARM' || t === 'COOL') ?? 'COOL',
        phone: c?.phone ?? null,
        email: c?.email ?? null,
        legacyId: cs.map((x) => x.legacy_id).find(Boolean) ?? null,
        lastActivityAt: (a.last_activity_at as string) ?? null,
        cryptoScore: (a.crypto_score as number) ?? null,
      };
    });

    // ---- lead signals, in chunks (the 1,000-row cap is not the only limit;
    //      a URL built from 8,000 ids will not survive PostgREST either) -----
    const legacyIds = accounts.map((a) => a.legacyId).filter(Boolean) as string[];
    const signals = new Map<string, PlannerSignal>();
    for (let i = 0; i < legacyIds.length; i += 300) {
      const { data } = await supabase.rpc('get_planner_signals', {
        p_legacy_ids: legacyIds.slice(i, i + 300),
      });
      for (const s of (data ?? []) as PlannerSignal[]) signals.set(s.place_id, s);
    }

    // ---- promises already made --------------------------------------------
    const { endIso } = dayBoundsUtc(planDate, tz);
    const { data: actRows } = await supabase
      .from('activities')
      .select('id, type, subject, scheduled_at, account_id, contact_id')
      .eq('owner_id', profile.id)
      .is('completed_at', null)
      .not('scheduled_at', 'is', null)
      .lt('scheduled_at', endIso)
      .neq('type', 'meeting') // meetings are the field block, not the desk
      .order('scheduled_at', { ascending: true })
      .limit(60);

    const commitments: PlannerCommitment[] = (actRows ?? []).map((a) => ({
      activityId: a.id as string,
      accountId: (a.account_id as string) ?? null,
      contactId: (a.contact_id as string) ?? null,
      subject: (a.subject as string) ?? 'Follow up',
      scheduledAt: a.scheduled_at as string,
      type: (a.type as string) ?? 'call',
    }));

    // ---- signed, never invoiced -------------------------------------------
    const { data: agreements } = await supabase
      .from('trial_agreements')
      .select('deal_id, signed_at, kind, deal:deals!inner(id, account_id, owner_id)')
      .eq('kind', 'purchase')
      .order('signed_at', { ascending: true })
      .limit(50);

    const dealIds = (agreements ?? []).map((r) => r.deal_id as string).filter(Boolean);
    const { data: invoices } = dealIds.length
      ? await supabase.from('invoices').select('deal_id').in('deal_id', dealIds)
      : { data: [] as { deal_id: string }[] };
    const invoiced = new Set((invoices ?? []).map((i) => i.deal_id as string));

    const signedNoInvoice = (agreements ?? [])
      .filter((r) => !invoiced.has(r.deal_id as string))
      .map((r) => {
        const d = (Array.isArray(r.deal) ? r.deal[0] : r.deal) as { account_id: string; owner_id: string } | null;
        return {
          accountId: d?.account_id ?? '',
          ownerId: d?.owner_id ?? '',
          name: '',
          days: Math.max(0, Math.floor((now - Date.parse(r.signed_at as string)) / 86400000)),
        };
      })
      .filter((g) => g.accountId && g.ownerId === profile.id);

    // ---- rank --------------------------------------------------------------
    const calls = buildCallList(accounts, signals, commitments, {
      now,
      budget: DEFAULT_CALL_BUDGET,
    });
    const sends = buildSendList(accounts, signals, {
      now,
      budget: DEFAULT_SEND_BUDGET,
      signedNoInvoice,
      exclude: new Set(calls.map((c) => c.accountId).filter(Boolean) as string[]),
    });

    // ---- persist, keeping anything already finished ------------------------
    const { data: existing } = await supabase
      .from('day_plans')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('plan_date', planDate)
      .maybeSingle();

    let planId = existing?.id as string | undefined;
    if (planId) {
      await supabase
        .from('day_plan_items')
        .delete()
        .eq('plan_id', planId)
        .eq('state', 'pending');
      await supabase
        .from('day_plans')
        .update({ generated_at: new Date().toISOString(), region_id: profile.region_id })
        .eq('id', planId);
    } else {
      const { data: created, error } = await supabase
        .from('day_plans')
        .insert({
          org_id: profile.org_id,
          region_id: profile.region_id,
          profile_id: profile.id,
          plan_date: planDate,
          params: { callBudget: DEFAULT_CALL_BUDGET, sendBudget: DEFAULT_SEND_BUDGET, tz },
        })
        .select('id')
        .single();
      if (error) return { ok: false, message: error.message };
      planId = created.id as string;
    }

    // Anything already done or skipped today keeps its place and is not
    // suggested again.
    const { data: kept } = await supabase
      .from('day_plan_items')
      .select('account_id')
      .eq('plan_id', planId)
      .neq('state', 'pending');
    const settled = new Set((kept ?? []).map((k) => k.account_id as string).filter(Boolean));

    const rows = [...calls, ...sends]
      .filter((i) => !i.accountId || !settled.has(i.accountId))
      .map((i, idx) => ({
        plan_id: planId,
        block: 'desk',
        kind: i.kind,
        sequence: idx,
        account_id: i.accountId,
        contact_id: i.contactId,
        activity_id: i.activityId,
        reason: i.reason,
        score: i.score,
        est_minutes: i.estMinutes,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from('day_plan_items').insert(rows);
      if (error) return { ok: false, message: error.message };
    }

    revalidatePath('/plan');
    return { ok: true, planId };
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
    const { error } = await supabase
      .from('day_plan_items')
      .update({ state, outcome: outcome ?? null, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/plan');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not update that.' };
  }
}
