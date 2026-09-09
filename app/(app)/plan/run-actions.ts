'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { todayIn, dayBoundsUtc, DEFAULT_TZ, type TimeZone } from '@/lib/db/tz';
import { buildRuns, type Door, type Run } from '@/lib/planner/runs';

export type RunOffer = {
  label: string;
  reason: string;
  doors: number;
  claimable: number;
  estMinutes: number;
  accountIds: string[];
  centerLat: number;
  centerLng: number;
};

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id, region_id')
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
 * What a rep could go and do. Computed fresh, never stored - an offer nobody
 * took is not history worth keeping, and a stale offer is worse than none.
 */
export async function offerRuns(): Promise<Result<{ runs: RunOffer[] }>> {
  try {
    const { supabase, profile, tz } = await me();

    const { data, error } = await supabase.rpc('get_canvas_candidates', {
      p_region_id: profile.region_id,
      p_owner_id: profile.id,
      p_cold_days: 30,
    });
    if (error) return { ok: false, message: error.message };

    const doors: Door[] = ((data ?? []) as Record<string, unknown>[]).map((d) => ({
      accountId: d.account_id as string,
      name: d.name as string,
      vertical: (d.vertical as string) ?? '',
      city: (d.city as string) ?? null,
      address: (d.address as string) ?? null,
      lat: d.lat as number,
      lng: d.lng as number,
      band: (d.band as string) ?? 'COOL',
      cryptoScore: (d.crypto_score as number) ?? null,
      ownerId: (d.owner_id as string) ?? null,
      lastActivityAt: (d.last_activity_at as string) ?? null,
      lastEngagedAt: (d.last_engaged_at as string) ?? null,
    }));

    // Today's meetings anchor the offers - a pocket near where you already
    // have to be beats one slightly denser across town.
    const planDate = todayIn(tz);
    const { startIso, endIso } = dayBoundsUtc(planDate, tz);
    const { data: meetings } = await supabase
      .from('activities')
      .select('account:accounts(latitude, longitude)')
      .eq('owner_id', profile.id)
      .eq('type', 'meeting')
      .is('completed_at', null)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso);

    const anchors = ((meetings ?? []) as Record<string, unknown>[])
      .map((m) => (Array.isArray(m.account) ? m.account[0] : m.account) as { latitude: number | null; longitude: number | null } | null)
      .filter((a): a is { latitude: number; longitude: number } => !!a?.latitude && !!a?.longitude)
      .map((a) => ({ lat: a.latitude, lng: a.longitude }));

    // Pockets already being walked today are not offered again.
    const { data: taken } = await supabase
      .from('day_runs')
      .select('id, day_run_stops(account_id)')
      .eq('profile_id', profile.id)
      .eq('plan_date', planDate)
      .neq('state', 'abandoned');

    const busy = new Set<string>();
    for (const r of (taken ?? []) as Record<string, unknown>[]) {
      for (const s of (r.day_run_stops ?? []) as { account_id: string }[]) busy.add(s.account_id);
    }

    const runs: Run[] = buildRuns(
      doors.filter((d) => !busy.has(d.accountId)),
      { now: Date.now(), anchors, max: 3 },
    );

    return {
      ok: true,
      runs: runs.map((r) => ({
        label: r.label,
        reason: r.reason,
        doors: r.doors.length,
        claimable: r.claimable,
        estMinutes: r.estMinutes,
        accountIds: r.doors.map((d) => d.accountId),
        centerLat: r.centerLat,
        centerLng: r.centerLng,
      })),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not build any runs.' };
  }
}

/**
 * Taking a run claims every unowned door in it.
 *
 * This is the point of the whole feature: territory gets claimed by walking
 * it. The claim happens through a security-definer function that only ever
 * fills an empty owner, so it can never take a shop off another rep.
 */
/**
 * "I have two hours and I am standing here."
 *
 * The rep taps a button between appointments, we take their position, and
 * offer pockets they can actually walk before the next one. Same candidate
 * pool as offerRuns - which already includes unclaimed doors, and those are
 * usually the point of a gap like this.
 */
export async function offerRunsNear(input: {
  lat: number;
  lng: number;
  minutes: number;
}): Promise<Result<{ runs: RunOffer[] }>> {
  try {
    const { supabase, profile, tz } = await me();

    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      return { ok: false, message: 'No usable location.' };
    }
    const budget = Math.min(480, Math.max(30, Math.round(input.minutes)));

    const { data, error } = await supabase.rpc('get_canvas_candidates', {
      p_region_id: profile.region_id,
      p_owner_id: profile.id,
      p_cold_days: 30,
    });
    if (error) return { ok: false, message: error.message };

    const doors: Door[] = ((data ?? []) as Record<string, unknown>[]).map((d) => ({
      accountId: d.account_id as string,
      name: d.name as string,
      vertical: (d.vertical as string) ?? '',
      city: (d.city as string) ?? null,
      address: (d.address as string) ?? null,
      lat: d.lat as number,
      lng: d.lng as number,
      band: (d.band as string) ?? 'COOL',
      cryptoScore: (d.crypto_score as number) ?? null,
      ownerId: (d.owner_id as string) ?? null,
      lastActivityAt: (d.last_activity_at as string) ?? null,
      lastEngagedAt: (d.last_engaged_at as string) ?? null,
    }));

    // Do not offer a pocket that is already being walked today.
    const planDate = todayIn(tz);
    const { data: taken } = await supabase
      .from('day_runs')
      .select('id, day_run_stops(account_id)')
      .eq('profile_id', profile.id)
      .eq('plan_date', planDate)
      .neq('state', 'abandoned');

    const busy = new Set<string>();
    for (const r of (taken ?? []) as Record<string, unknown>[]) {
      for (const st of (r.day_run_stops ?? []) as { account_id: string }[]) busy.add(st.account_id);
    }

    const runs: Run[] = buildRuns(doors.filter((d) => !busy.has(d.accountId)), {
      now: Date.now(),
      origin: { lat: input.lat, lng: input.lng },
      budgetMinutes: budget,
      max: 3,
    });

    if (runs.length === 0) {
      return {
        ok: false,
        message: `Nothing walkable within six miles that fits ${budget} minutes. Try a longer window.`,
      };
    }

    return {
      ok: true,
      runs: runs.map((r) => ({
        label: r.label,
        reason: r.reason,
        doors: r.doors.length,
        claimable: r.claimable,
        estMinutes: r.estMinutes,
        accountIds: r.doors.map((d) => d.accountId),
        centerLat: r.centerLat,
        centerLng: r.centerLng,
      })),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not build a run from here.' };
  }
}

export async function takeRun(offer: RunOffer): Promise<Result<{ runId: string; claimed: number }>> {
  try {
    const { supabase, profile, tz } = await me();
    if (offer.accountIds.length === 0) return { ok: false, message: 'That run has no doors left.' };

    const { data: claimed, error: claimErr } = await supabase.rpc('claim_accounts', {
      p_account_ids: offer.accountIds,
      p_owner_id: profile.id,
    });
    if (claimErr) return { ok: false, message: claimErr.message };

    const { data: run, error } = await supabase
      .from('day_runs')
      .insert({
        org_id: profile.org_id,
        region_id: profile.region_id,
        profile_id: profile.id,
        plan_date: todayIn(tz),
        kind: 'canvas',
        label: offer.label,
        doors: offer.accountIds.length,
        est_minutes: offer.estMinutes,
        center_lat: offer.centerLat,
        center_lng: offer.centerLng,
      })
      .select('id')
      .single();
    if (error) return { ok: false, message: error.message };

    const { error: stopsErr } = await supabase.from('day_run_stops').insert(
      offer.accountIds.map((id, i) => ({
        run_id: run.id as string,
        account_id: id,
        sequence: i,
        claimed: true,
      })),
    );
    if (stopsErr) return { ok: false, message: stopsErr.message };

    revalidatePath('/plan');
    return { ok: true, runId: run.id as string, claimed: (claimed as number) ?? 0 };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not start that run.' };
  }
}

export async function setStopState(
  stopId: string,
  state: 'pending' | 'done' | 'skipped',
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('day_run_stops')
      .update({ state, updated_at: new Date().toISOString() })
      .eq('id', stopId)
      .select('id');
    if (error) return { ok: false, message: error.message };
    if (!data || data.length === 0) return { ok: false, message: 'That stop did not update.' };
    revalidatePath('/plan');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not update that stop.' };
  }
}

export async function endRun(runId: string, state: 'done' | 'abandoned'): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('day_runs').update({ state }).eq('id', runId);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/plan');
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not close that run.' };
  }
}
