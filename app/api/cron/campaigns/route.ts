import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, runCampaign, type CampaignSettings } from '@/lib/campaigns/engine';

// Daily campaign send. Replaces `npm run send` on someone's laptop: every
// org whose campaign is RUNNING gets its batch, using that org's own
// Resend key. Scheduled 13:00 UTC = 6:00 AM Phoenix (vercel.json).
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = serviceClient();
  const { data: orgs, error } = await supabase
    .from('campaign_settings')
    .select('*')
    .eq('status', 'running');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Record<string, unknown>[] = [];
  for (const s of (orgs ?? []) as CampaignSettings[]) {
    try {
      const r = await runCampaign(s, 'cron');
      results.push({ org: s.org_id, ...r });
    } catch (e) {
      results.push({ org: s.org_id, error: e instanceof Error ? e.message : 'failed' });
    }
  }
  return NextResponse.json({ ok: true, orgs: results.length, results });
}
