// The campaign engine, ported from the local `npm run send` CLI so any
// NectarPay group can run their own sequence from the app. Every rule the
// CLI earned the hard way is preserved:
//   - engagement suppression (any non-view Pulse event ends the sequence)
//   - follow-ups before fresh opens, oldest stages first
//   - named leads before unnamed, both ordered by score (not alphabetically)
//   - one email per inbox per run, and sibling locations sharing that inbox
//     get marked contacted too (the Zen Leaf x5 lesson)
//   - native leads cap at e4; flagged leads get the native story while
//     keeping their locked vertical in the database
// Each org brings its OWN Resend key, so sending reputation stays theirs.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  renderEmail, maxStageFor, CLUSTER_MAP, DEFAULT_REP,
  type Cluster, type Rep, type Stage, type TemplateLead,
} from './templates';

export type CampaignSettings = {
  org_id: string;
  status: 'paused' | 'running';
  resend_api_key: string | null;
  from_domain: string | null;
  from_label: string | null;
  reply_to: string | null;
  physical_address: string | null;
  pulse_base_url: string | null;
  campaign_start: string;
  ramp: { throughDay: number; dailyCap: number }[];
  followup_gap_days: Record<string, number>;
  send_delay_ms: number;
  last_run_at: string | null;
  // Launch scoping: when set, ONLY leads assigned to this rep are emailed.
  // Keeps the sequence and the CRM in sync - a rep should never get a
  // reply about a shop that isn't in their book.
  send_owner_id: string | null;
};

type LeadRow = TemplateLead & {
  place_id: string;
  emails: string[];
  band: string;
  score: number;
  status: string;
  email_stage: number;
  last_emailed_at: string | null;
  crypto_native: boolean | null;
};

export type PlanItem = {
  placeId: string;
  stage: Stage;
  to: string;
  name: string;
  vertical: string;
  band: string;
  repFirst: string;
};

export type RunResult = {
  planned: number;
  sent: number;
  failed: number;
  mix: Record<string, number>;
  note?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cityShort = (city: string | null) => (city ?? 'Phoenix').replace(/\s+AZ$/, '');

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase service env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function todaysCap(s: CampaignSettings): number {
  const start = new Date(s.campaign_start + 'T00:00:00');
  const day = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
  const ramp = s.ramp ?? [];
  for (const r of ramp) if (day <= r.throughDay) return r.dailyCap;
  return ramp.length ? ramp[ramp.length - 1].dailyCap : 30;
}

export function campaignDay(s: CampaignSettings): number {
  const start = new Date(s.campaign_start + 'T00:00:00');
  return Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
}

const SELECT =
  'place_id, name, city, vertical, vertical_label, owner_first_name, pulse_token, emails, band, score, status, email_stage, last_emailed_at, crypto_native';

/** Builds today's send plan without sending anything. */
export async function buildPlan(
  supabase: SupabaseClient,
  settings: CampaignSettings
): Promise<{ plan: { lead: LeadRow; stage: Stage }[]; repFor: (placeId: string) => Rep; cap: number }> {
  const cap = todaysCap(settings);

  // Rep routing: CRM owner assignment decides who the email comes from
  const { data: repRows } = await supabase
    .from('reps')
    .select('profile_id, first_name, from_email, is_default, active')
    .eq('active', true);
  const repsById = new Map<string, Rep>(
    (repRows ?? []).map((r) => [r.profile_id, { first: r.first_name, fromEmail: r.from_email }])
  );
  const defaultRep: Rep =
    (repRows ?? []).filter((r) => r.is_default).map((r) => ({ first: r.first_name, fromEmail: r.from_email }))[0] ??
    DEFAULT_REP;

  const { data: ownerRows } = await supabase
    .from('contacts')
    .select('legacy_id, owner_id')
    .not('legacy_id', 'is', null)
    .not('owner_id', 'is', null);
  const ownerByPlace = new Map<string, string>(
    (ownerRows ?? []).map((c) => [c.legacy_id as string, c.owner_id as string])
  );
  const repFor = (placeId: string): Rep => {
    const ownerId = ownerByPlace.get(placeId);
    return (ownerId && repsById.get(ownerId)) || defaultRep;
  };

  // Any hard Pulse engagement ends the sequence - the lead is a rep's now
  const { data: engaged } = await supabase.from('engagement_events').select('pulse_token').neq('event', 'view');
  const engagedTokens = new Set((engaged ?? []).map((e) => e.pulse_token));

  // Scope to one rep's book when configured
  let scopeIds: string[] | null = null;
  if (settings.send_owner_id) {
    const { data: owned } = await supabase
      .from('contacts')
      .select('legacy_id')
      .eq('owner_id', settings.send_owner_id)
      .not('legacy_id', 'is', null);
    scopeIds = (owned ?? []).map((c) => c.legacy_id as string);
    if (scopeIds.length === 0) return { plan: [], repFor, cap };
  }
  const scopeSet = scopeIds ? new Set(scopeIds) : null;
  const inScope = (l: { place_id: string }) => !scopeSet || scopeSet.has(l.place_id);

  const cutoff = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const isNative = (l: LeadRow) => !!l.crypto_native || l.vertical === 'crypto-native';
  const stageCap = (l: LeadRow) => maxStageFor(isNative(l) ? 'native' : ((CLUSTER_MAP[l.vertical] ?? 'math') as Cluster));

  // Follow-ups first, oldest stages first
  const followups: { lead: LeadRow; stage: Stage }[] = [];
  for (const stage of [6, 5, 4, 3, 2] as Stage[]) {
    const gap = settings.followup_gap_days?.[String(stage)];
    if (!gap) continue;
    const { data } = await supabase
      .from('nectarpay_leads')
      .select(SELECT)
      .eq('status', 'EMAILED')
      .eq('email_stage', stage - 1)
      .lte('last_emailed_at', cutoff(gap))
      .neq('emails', '{}')
      .eq('compliance_hold', false) // held verticals never send (042)
      .limit(scopeSet ? 2000 : cap);
    for (const l of (data ?? []) as LeadRow[]) {
      if (!inScope(l)) continue;
      if (stage > stageCap(l)) continue;
      followups.push({ lead: l, stage });
    }
  }

  // Fresh e1s: named leads by score, then unnamed by score
  const [{ data: e1Named }, { data: e1Unnamed }] = await Promise.all([
    supabase.from('nectarpay_leads').select(SELECT)
      .eq('status', 'NEW').eq('email_stage', 0).neq('emails', '{}')
      .eq('compliance_hold', false) // held verticals never send (042)
      .not('owner_first_name', 'is', null)
      .order('score', { ascending: false }).limit(scopeSet ? 4000 : cap * 2),
    supabase.from('nectarpay_leads').select(SELECT)
      .eq('status', 'NEW').eq('email_stage', 0).neq('emails', '{}')
      .eq('compliance_hold', false)
      .is('owner_first_name', null)
      .order('score', { ascending: false }).limit(scopeSet ? 4000 : cap * 2),
  ]);

  const jobs: { lead: LeadRow; stage: Stage }[] = [...followups];
  for (const l of [...((e1Named ?? []) as LeadRow[]), ...((e1Unnamed ?? []) as LeadRow[])]) {
    if (!inScope(l)) continue;
    jobs.push({ lead: l, stage: 1 as Stage });
  }

  // One email per inbox per run
  const seen = new Set<string>();
  const plan = jobs
    .filter((j) => !engagedTokens.has(j.lead.pulse_token))
    .filter((j) => {
      const addr = j.lead.emails?.[0]?.toLowerCase();
      if (!addr || seen.has(addr)) return false;
      seen.add(addr);
      return true;
    })
    .slice(0, cap);

  return { plan, repFor, cap };
}

export function planMix(plan: { stage: Stage }[]): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const j of plan) mix[`e${j.stage}`] = (mix[`e${j.stage}`] ?? 0) + 1;
  return mix;
}

export function planPreview(
  plan: { lead: LeadRow; stage: Stage }[],
  repFor: (placeId: string) => Rep
): PlanItem[] {
  return plan.map(({ lead, stage }) => ({
    placeId: lead.place_id,
    stage,
    to: lead.emails[0],
    name: lead.name,
    vertical: lead.vertical,
    band: lead.band,
    repFirst: repFor(lead.place_id).first,
  }));
}

/** Sends today's batch and records the run. */
export async function runCampaign(
  settings: CampaignSettings,
  trigger: 'cron' | 'manual'
): Promise<RunResult> {
  const supabase = serviceClient();

  if (!settings.resend_api_key) return { planned: 0, sent: 0, failed: 0, mix: {}, note: 'No Resend API key configured' };
  if (!settings.physical_address) return { planned: 0, sent: 0, failed: 0, mix: {}, note: 'No physical address (required by CAN-SPAM)' };
  if (!settings.pulse_base_url) return { planned: 0, sent: 0, failed: 0, mix: {}, note: 'No Pulse base URL configured' };

  const { plan, repFor } = await buildPlan(supabase, settings);
  const mix = planMix(plan);
  let sent = 0;
  let failed = 0;

  for (const { lead, stage } of plan) {
    const to = lead.emails[0];
    const rep = repFor(lead.place_id);
    const isNative = !!lead.crypto_native || lead.vertical === 'crypto-native';
    const rendered = renderEmail(
      stage,
      { ...lead, city: cityShort(lead.city), vertical: isNative ? 'crypto-native' : lead.vertical },
      settings.pulse_base_url,
      settings.physical_address,
      rep
    );

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${rep.first} at ${settings.from_label ?? 'NectarPay'} <${rep.fromEmail}>`,
        to,
        reply_to: settings.reply_to || rep.fromEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });

    if (!res.ok) {
      failed++;
      console.error('send failed', to, res.status, await res.text());
    } else {
      sent++;
      const stamp = new Date().toISOString();
      await supabase
        .from('nectarpay_leads')
        .update({ status: 'EMAILED', email_stage: stage, last_emailed_at: stamp })
        .eq('place_id', lead.place_id);
      // Sibling locations sharing this inbox count as contacted too
      await supabase
        .from('nectarpay_leads')
        .update({ status: 'EMAILED', email_stage: stage, last_emailed_at: stamp })
        .eq('status', 'NEW')
        .contains('emails', [to]);
    }
    await sleep(settings.send_delay_ms ?? 700);
  }

  await supabase.from('campaign_runs').insert({
    org_id: settings.org_id,
    trigger,
    planned: plan.length,
    sent,
    failed,
    mix,
  });
  await supabase
    .from('campaign_settings')
    .update({ last_run_at: new Date().toISOString() })
    .eq('org_id', settings.org_id);

  return { planned: plan.length, sent, failed, mix };
}
