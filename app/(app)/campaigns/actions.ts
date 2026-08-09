'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  serviceClient, runCampaign, buildPlan, planPreview, todaysCap, campaignDay,
  type CampaignSettings, type PlanItem,
} from '@/lib/campaigns/engine';

async function adminSettings(): Promise<CampaignSettings> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) throw new Error('Admins only');
  // RLS on campaign_settings already restricts this to admins of the org
  const { data } = await supabase.from('campaign_settings').select('*').eq('org_id', profile.org_id).single();
  if (!data) throw new Error('No campaign settings row - run migration 038');
  return data as CampaignSettings;
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
}) {
  const current = await adminSettings();
  const supabase = await createClient();
  const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
  // An empty key field means "leave it alone", never "erase it"
  if (!input.resend_api_key) delete patch.resend_api_key;
  const { error } = await supabase.from('campaign_settings').update(patch).eq('org_id', current.org_id);
  if (error) throw new Error(error.message);
  revalidatePath('/campaigns');
  return { ok: true };
}

export async function setCampaignStatus(status: 'running' | 'paused') {
  const current = await adminSettings();
  const supabase = await createClient();
  const { error } = await supabase
    .from('campaign_settings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('org_id', current.org_id);
  if (error) throw new Error(error.message);
  revalidatePath('/campaigns');
  return { ok: true, status };
}

// Dry run: what WOULD go out right now, sending nothing
export async function previewToday(): Promise<{ items: PlanItem[]; cap: number; day: number }> {
  const settings = await adminSettings();
  const svc = serviceClient();
  const { plan, repFor, cap } = await buildPlan(svc, settings);
  return { items: planPreview(plan, repFor).slice(0, 50), cap, day: campaignDay(settings) };
}

// Manual "send today's batch now"
export async function sendNow() {
  const settings = await adminSettings();
  const result = await runCampaign(settings, 'manual');
  revalidatePath('/campaigns');
  revalidatePath('/dashboard');
  return result;
}

export async function campaignSnapshot() {
  const settings = await adminSettings();
  return { cap: todaysCap(settings), day: campaignDay(settings) };
}
