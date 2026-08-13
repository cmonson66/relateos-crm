import { createClient } from '@/lib/supabase/server';
import { BackLink } from '@/components/app/back-link';
import { getUser } from '@/lib/auth/get-user';
import { notFound } from 'next/navigation';
import { CampaignControl } from './_components/campaign-control';
import { todaysCap, campaignDay, type CampaignSettings } from '@/lib/campaigns/engine';
import { resolveRegion, zoneOf } from '@/lib/campaigns/region';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const { profile } = await getUser();
  if (!['super_admin', 'admin'].includes(profile.role)) notFound();

  const supabase = await createClient();

  // One campaign per region since 060. Corporate has no region of their own,
  // so resolveRegion falls back to the oldest - Phoenix.
  const { region } = await resolveRegion(supabase, profile.org_id, profile.region_id ?? null);
  const tz = zoneOf(region);

  const [{ data: settings }, { data: runs }, { data: people }] = await Promise.all([
    region
      ? supabase.from('campaign_settings').select('*').eq('region_id', region.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('campaign_runs').select('*')
      .eq('region_id', region?.id ?? '00000000-0000-0000-0000-000000000000')
      .order('ran_at', { ascending: false }).limit(10),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true)
      .in('role', ['super_admin', 'admin', 'manager', 'rep']).order('full_name'),
  ]);

  // Counted through a security-definer bridge (044): nectarpay_leads RLS
  // gives app users nothing, so direct counts here all came back 0
  const { data: statsRaw } = await supabase.rpc('get_campaign_stats');
  const stats = (statsRaw ?? {}) as {
    stages?: Record<string, number>;
    queued?: number; emailable?: number; engaged?: number; held?: number;
  };
  const stageCounts = Array.from({ length: 7 }, (_, i) => stats.stages?.[String(i)] ?? 0);
  const engagedCount = stats.engaged ?? 0;
  const queued = stats.queued ?? 0;
  const emailable = stats.emailable ?? 0;

  if (!settings) {
    return (
      <div className="p-8">
      <BackLink fallbackHref="/dashboard" fallbackLabel="Dashboard" />

        <h1 className="font-display text-3xl tracking-wider">CAMPAIGN</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No campaign settings for this region yet - apply migrations 058 through 060, then reload.
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
        assigned_only: s.assigned_only ?? true,
      }}
      people={(people ?? []).map(p => ({ id: p.id, name: p.full_name || p.email || 'Rep' }))}
      cap={todaysCap(s, tz)}
      day={campaignDay(s, tz)}
      queued={queued}
      emailable={emailable}
      stageCounts={stageCounts}
      engagedCount={engagedCount ?? 0}
      runs={(runs ?? []).map(r => ({
        id: r.id, ran_at: r.ran_at, trigger: r.trigger,
        planned: r.planned, sent: r.sent, failed: r.failed,
        mix: (r.mix ?? {}) as Record<string, number>,
      }))}
    />
  );
}
