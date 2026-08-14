'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  serviceClient, runCampaign, buildPlan, planPreview, todaysCap, campaignDay,
  type CampaignSettings, type PlanItem,
} from '@/lib/campaigns/engine';
import { resolveRegion, zoneOf, type RegionRow } from '@/lib/campaigns/region';

// Since 060 there is one settings row PER REGION, so .eq('org_id').single()
// would throw the moment a second region exists. Everything here resolves a
// region first and keys on it.
async function adminSettings(
  regionId?: string | null
): Promise<{ settings: CampaignSettings; region: RegionRow | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase
    .from('profiles').select('org_id, role, region_id').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) throw new Error('Admins only');

  const { region } = await resolveRegion(supabase, profile.org_id, profile.region_id ?? null, regionId);
  if (!region) throw new Error('No region configured - run migration 058');

  // RLS on campaign_settings already restricts this to admins of the org
  const { data } = await supabase
    .from('campaign_settings').select('*').eq('region_id', region.id).single();
  if (!data) throw new Error(`No campaign settings for ${region.name} - run migration 060`);
  return { settings: data as CampaignSettings, region };
}

export async function saveCampaignSettings(input: {
  resend_api_key?: string | null;
  from_domain?: string | null;
  from_label?: string | null;
  reply_to?: string | null;
  physical_address?: string | null;
  pulse_base_url?: string | null;
  campaign_start?: string;
  send_delay_ms?: number;
  send_owner_id?: string | null;
  assigned_only?: boolean;
}, regionId?: string) {
  const { settings: current } = await adminSettings(regionId);
  const supabase = await createClient();
  const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
  // Empty string from the dropdown means "no scoping"
  if (input.send_owner_id === '') patch.send_owner_id = null;
  // An empty key field means "leave it alone", never "erase it"
  if (!input.resend_api_key) delete patch.resend_api_key;
  const { error } = await supabase.from('campaign_settings').update(patch).eq('region_id', current.region_id);
  if (error) throw new Error(error.message);
  revalidatePath('/campaigns');
  return { ok: true };
}

export async function setCampaignStatus(status: 'running' | 'paused', regionId?: string) {
  const { settings: current, region } = await adminSettings(regionId);

  // Server-side twin of the client gate. The button already refuses, but a
  // half-configured region starting a 30-a-day cold send is exactly the thing
  // that should not depend on the browser being honest - and with from_domain
  // blank the engine would build a From address out of nothing.
  //
  // reply_to is deliberately NOT required. Phoenix has run without one since
  // launch; making it blocking would have paused a working campaign.
  if (status === 'running') {
    const missing = [
      !current.resend_api_key && 'Resend key',
      !current.from_domain && 'sending domain',
      !current.physical_address && 'physical address',
      !current.pulse_base_url && 'Pulse URL',
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
      throw new Error(`${region?.code ?? 'This region'} still needs: ${missing.join(', ')}.`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('campaign_settings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('region_id', current.region_id);
  if (error) throw new Error(error.message);
  revalidatePath('/campaigns');
  return { ok: true, status };
}

// Dry run: what WOULD go out right now, sending nothing
export async function previewToday(regionId?: string): Promise<{ items: PlanItem[]; cap: number; day: number }> {
  const { settings, region } = await adminSettings(regionId);
  const tz = zoneOf(region);
  const svc = serviceClient();
  const { plan, repFor, cap } = await buildPlan(svc, settings, tz);
  return { items: planPreview(plan, repFor).slice(0, 50), cap, day: campaignDay(settings, tz) };
}

// Manual "send today's batch now"
export async function sendNow(regionId?: string) {
  const { settings, region } = await adminSettings(regionId);
  const result = await runCampaign(settings, 'manual', zoneOf(region));
  revalidatePath('/campaigns');
  revalidatePath('/dashboard');
  return result;
}

export async function campaignSnapshot(regionId?: string) {
  const { settings, region } = await adminSettings(regionId);
  const tz = zoneOf(region);
  return { cap: todaysCap(settings, tz), day: campaignDay(settings, tz) };
}
