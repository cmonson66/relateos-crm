import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { listRegions } from '@/lib/campaigns/region';
import { DEFAULT_TZ, type TimeZone } from '@/lib/db/tz';

/**
 * Which region a corporate viewer is looking at, on every page.
 *
 * The URL is still the source of truth - a link to /deals?region=<id> means
 * that region - but the choice is REMEMBERED in a cookie so it survives
 * navigation. Without that, switching to DFW on Deals and clicking through to
 * Contacts silently drops you back to every region, which is precisely the
 * workflow this exists for: look at one market across the whole app.
 *
 * Reps and managers never get a region here. RLS already fences them to their
 * own, so a second filter would be redundant, and an empty region list means
 * no switcher renders for them at all.
 */

export const REGION_COOKIE = 'np_region';

export type ScopeRegion = { id: string; code: string; name: string };

export type RegionScope = {
  regions: ScopeRegion[];
  activeRegionId: string | null;
  isCorporate: boolean;
  /**
   * Whose clock this page should draw on. A rep or manager gets their own
   * region's; corporate gets the region they are viewing, or Phoenix while
   * looking at all of them - there is no single honest answer for "every
   * region at once", and Phoenix is where the company is.
   */
  timezone: TimeZone;
};

export async function regionScope(
  supabase: SupabaseClient,
  profile: { role: string; org_id: string; region_id?: string | null },
  paramRegion?: string | null,
): Promise<RegionScope> {
  const isCorporate = profile.role === 'super_admin' || profile.role === 'admin';

  if (!isCorporate) {
    // No switcher, but they still need their own clock: a Dallas rep's
    // calendar must draw Dallas days.
    let timezone: TimeZone = DEFAULT_TZ;
    if (profile.region_id) {
      const { data } = await supabase
        .from('regions').select('timezone').eq('id', profile.region_id).maybeSingle();
      if (data?.timezone) timezone = data.timezone as TimeZone;
    }
    return { regions: [], activeRegionId: null, isCorporate: false, timezone };
  }

  const rows = await listRegions(supabase, profile.org_id);
  const regions: ScopeRegion[] = rows.map((r) => ({ id: r.id, code: r.code, name: r.name }));

  const jar = await cookies();
  const remembered = jar.get(REGION_COOKIE)?.value ?? null;
  const wanted = paramRegion ?? remembered;

  // Validated against the caller's own regions, so a stale cookie from a
  // deleted region - or one pasted from another org - resolves to "all"
  // rather than an empty page nobody can explain.
  const activeRegionId = wanted && regions.some((r) => r.id === wanted) ? wanted : null;

  let timezone: TimeZone = DEFAULT_TZ;
  if (activeRegionId) {
    const { data } = await supabase
      .from('regions').select('timezone').eq('id', activeRegionId).maybeSingle();
    if (data?.timezone) timezone = data.timezone as TimeZone;
  }

  return { regions, activeRegionId, isCorporate: true, timezone };
}
