import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, runCampaign, type CampaignSettings } from '@/lib/campaigns/engine';
import { hourIn, todayIn } from '@/lib/db/tz';

// Campaign send, now HOURLY (vercel.json) instead of once at 13:00 UTC.
//
// One fixed UTC time cannot serve two regions: 13:00 UTC is 6 AM in Phoenix
// and 8 AM in Dallas, and the gap moves by an hour twice a year because Texas
// observes DST and Arizona does not. So the cron wakes every hour and each
// region acts only when its OWN clock reads its OWN send_hour.
//
// Running hourly means the guard matters: last_run_at is compared in the
// region's local calendar, so a region sends at most once per local day even
// if the cron fires twice inside its send hour or a deploy replays it.
export const maxDuration = 300;

type SettingsWithRegion = CampaignSettings & {
  regions: {
    id: string;
    code: string;
    name: string;
    timezone: string;
    send_hour: number;
    is_active: boolean;
  } | null;
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ?force=REGION_CODE runs one region immediately, ignoring the hour gate.
  // The once-per-local-day guard still applies - force is for testing the
  // send, not for sending a region's batch twice.
  const force = req.nextUrl.searchParams.get('force');

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('campaign_settings')
    .select('*, regions!inner(id, code, name, timezone, send_hour, is_active)')
    .eq('status', 'running');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as SettingsWithRegion[];
  const results: Record<string, unknown>[] = [];

  for (const s of rows) {
    const region = s.regions;
    if (!region) {
      results.push({ region: 'unknown', skipped: 'campaign has no region' });
      continue;
    }
    const tag = region.code;

    if (!region.is_active) {
      results.push({ region: tag, skipped: 'region inactive' });
      continue;
    }

    const localHour = hourIn(region.timezone);
    const localDay = todayIn(region.timezone);
    const forced = force != null && force.toUpperCase() === tag.toUpperCase();

    if (!forced && localHour !== region.send_hour) {
      results.push({ region: tag, skipped: `local hour ${localHour}, sends at ${region.send_hour}` });
      continue;
    }

    if (s.last_run_at && todayIn(region.timezone, new Date(s.last_run_at)) === localDay) {
      results.push({ region: tag, skipped: `already sent on ${localDay}` });
      continue;
    }

    try {
      const r = await runCampaign(s, 'cron', region.timezone);
      results.push({ region: tag, localDay, ...r });
    } catch (e) {
      results.push({ region: tag, error: e instanceof Error ? e.message : 'failed' });
    }
  }

  const ran = results.filter((r) => 'sent' in r).length;
  return NextResponse.json({ ok: true, regions: results.length, ran, results });
}
