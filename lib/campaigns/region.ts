// Which region's campaign am I looking at?
//
// A rep or manager has exactly one. Corporate (super_admin/admin) has
// region_id NULL by design, so they need a fallback, and the fallback has to
// be deterministic or the campaign page would show a different region
// depending on row order. Oldest region wins, which is Phoenix.
//
// Once the region switcher exists, `preferredId` is what it feeds in.

import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TZ, type TimeZone } from '@/lib/db/tz';

export type RegionRow = {
  id: string;
  org_id: string;
  name: string;
  code: string;
  timezone: TimeZone;
  send_hour: number;
  agenda_hour: number;
  is_active: boolean;
};

const REGION_SELECT = 'id, org_id, name, code, timezone, send_hour, agenda_hour, is_active';

export async function listRegions(
  supabase: SupabaseClient,
  orgId: string,
): Promise<RegionRow[]> {
  const { data } = await supabase
    .from('regions')
    .select(REGION_SELECT)
    .eq('org_id', orgId)
    .order('created_at');
  return (data ?? []) as RegionRow[];
}

/** preferred (a switcher choice) > the viewer's own region > oldest region. */
export function pickRegion(
  regions: RegionRow[],
  profileRegionId: string | null,
  preferredId?: string | null,
): RegionRow | null {
  if (regions.length === 0) return null;
  if (preferredId) {
    const hit = regions.find((r) => r.id === preferredId);
    if (hit) return hit;
  }
  if (profileRegionId) {
    const own = regions.find((r) => r.id === profileRegionId);
    if (own) return own;
  }
  return regions[0];
}

export async function resolveRegion(
  supabase: SupabaseClient,
  orgId: string,
  profileRegionId: string | null,
  preferredId?: string | null,
): Promise<{ region: RegionRow | null; regions: RegionRow[] }> {
  const regions = await listRegions(supabase, orgId);
  return { region: pickRegion(regions, profileRegionId, preferredId), regions };
}

/** Never let a missing region take the send path down; fall back to Phoenix. */
export function zoneOf(region: RegionRow | null): TimeZone {
  return region?.timezone ?? DEFAULT_TZ;
}
