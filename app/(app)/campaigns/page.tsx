import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { notFound } from 'next/navigation';
import { CampaignControl } from './_components/campaign-control';
import { todaysCap, campaignDay, type CampaignSettings } from '@/lib/campaigns/engine';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const { profile } = await getUser();
  if (!['super_admin', 'admin'].includes(profile.role)) notFound();

  const supabase = await createClient();
  const [{ data: settings }, { data: runs }, { count: queued }, { count: emailable }, { data: people }] = await Promise.all([
    supabase.from('campaign_settings').select('*').eq('org_id', profile.org_id).maybeSingle(),
    supabase.from('campaign_runs').select('*').order('ran_at', { ascending: false }).limit(10),
    supabase.from('nectarpay_leads').select('place_id', { count: 'exact', head: true })
      .eq('status', 'NEW').eq('email_stage', 0).neq('emails', '{}'),
    supabase.from('nectarpay_leads').select('place_id', { count: 'exact', head: true }).neq('emails', '{}'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true)
      .in('role', ['super_admin', 'admin', 'manager', 'rep']).order('full_name'),
  ]);

  if (!settings) {
    return (
      <div className="p-8">
        <h1 className="font-display text-3xl tracking-wider">CAMPAIGN</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No campaign settings row yet — apply migration 038, then reload.
        </p>
      </div>
    );
  }

  const s = settings as CampaignSettings;
  return (
    <CampaignControl
      settings={{
        status: s.status,
        hasKey: !!s.resend_api_key,
        from_domain: s.from_domain,
        from_label: s.from_label,
        reply_to: s.reply_to,
        physical_address: s.physical_address,
        pulse_base_url: s.pulse_base_url,
        campaign_start: s.campaign_start,
        send_delay_ms: s.send_delay_ms,
        last_run_at: s.last_run_at,
        send_owner_id: s.send_owner_id ?? null,
      }}
      people={(people ?? []).map(p => ({ id: p.id, name: p.full_name || p.email || 'Rep' }))}
      cap={todaysCap(s)}
      day={campaignDay(s)}
      queued={queued ?? 0}
      emailable={emailable ?? 0}
      runs={(runs ?? []).map(r => ({
        id: r.id, ran_at: r.ran_at, trigger: r.trigger,
        planned: r.planned, sent: r.sent, failed: r.failed,
        mix: (r.mix ?? {}) as Record<string, number>,
      }))}
    />
  );
}
