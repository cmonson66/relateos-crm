import type { SupabaseClient } from '@supabase/supabase-js';
import { todayIn, dayBoundsUtc, type TimeZone } from '@/lib/db/tz';
import { fetchAllRowsById } from '@/lib/db/fetch-all';
import {
  buildCallList,
  buildSendList,
  type PlannerAccount,
  type PlannerSignal,
  type PlannerCommitment,
} from '@/lib/planner/rank';

/**
 * Plan generation, with the Supabase client passed IN.
 *
 * Two callers need this and they authenticate differently: the rep tapping
 * "Plan my day" runs under their own session with RLS on, and the hourly
 * agenda cron runs under the service role with no session at all. Every
 * query below scopes by owner_id explicitly for exactly that reason - under
 * the service role there is no RLS to fall back on.
 */

export type PlannerProfile = {
  id: string;
  org_id: string;
  region_id: string | null;
};

export const DEFAULT_CALL_BUDGET = 12;
export const DEFAULT_SEND_BUDGET = 5;

export async function buildPlanFor(
  supabase: SupabaseClient,
  profile: PlannerProfile,
  tz: TimeZone,
): Promise<{ ok: true; planId: string } | { ok: false; message: string }> {
  try {
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

    // ---- what they did not get to yesterday --------------------------------
    // A rep who finished eight of twelve calls should not silently lose the
    // other four back into the general ranking. They were chosen for a reason
    // yesterday and that reason has only got a day older.
    const { data: priorPlans } = await supabase
      .from('day_plans')
      .select('id, plan_date')
      .eq('profile_id', profile.id)
      .lt('plan_date', planDate)
      .order('plan_date', { ascending: false })
      .limit(1);
    const priorPlan = (priorPlans ?? [])[0] as { id: string; plan_date: string } | undefined;

    const rolled: { accountId: string; contactId: string | null; kind: 'call' | 'send'; reason: string }[] = [];
    if (priorPlan) {
      const { data: stale } = await supabase
        .from('day_plan_items')
        .select('id, kind, account_id, contact_id, reason')
        .eq('plan_id', priorPlan.id)
        .eq('state', 'pending');
      for (const r of (stale ?? []) as Record<string, unknown>[]) {
        if (!r.account_id) continue;
        rolled.push({
          accountId: r.account_id as string,
          contactId: (r.contact_id as string) ?? null,
          kind: r.kind as 'call' | 'send',
          reason: `Did not get to this yesterday. ${r.reason as string}`,
        });
      }
      if ((stale ?? []).length > 0) {
        await supabase
          .from('day_plan_items')
          .update({ state: 'rolled', updated_at: new Date().toISOString() })
          .eq('plan_id', priorPlan.id)
          .eq('state', 'pending');
      }
    }
    const rolledAccounts = new Set(rolled.map((r) => r.accountId));

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

    const rolledItems = rolled.map((r) => ({
      kind: r.kind,
      accountId: r.accountId,
      contactId: r.contactId,
      activityId: null,
      reason: r.reason,
      score: 1000,
      estMinutes: r.kind === 'call' ? 6 : 3,
    }));

    const rows = [...rolledItems, ...calls, ...sends]
      .filter((i, idx, all) => {
        if (!i.accountId) return true;
        if (settled.has(i.accountId)) return false;
        // A rolled item already covers that shop; drop today's duplicate.
        if (i.score !== 1000 && rolledAccounts.has(i.accountId)) return false;
        return all.findIndex((o) => o.accountId === i.accountId && o.kind === i.kind) === idx;
      })
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

    return { ok: true, planId: planId as string };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not build the plan.' };
  }
}
