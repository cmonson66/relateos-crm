import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { listRegions } from '@/lib/campaigns/region';

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
};

export async function regionScope(
  supabase: SupabaseClient,
  profile: { role: string; org_id: string },
  paramRegion?: string | null,
): Promise<RegionScope> {
  const isCorporate = profile.role === 'super_admin' || profile.role === 'admin';
  if (!isCorporate) {
    return { regions: [], activeRegionId: null, isCorporate: false };
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

  return { regions, activeRegionId, isCorporate: true };
}
