// lib/brand/get-brand.ts
import { createClient } from '@/lib/supabase/server';
import { resolveBrand, type ResolvedBrand, type OrgBrand } from '@/lib/brand/brand';

// Loads the tenant brand for a given org_id and resolves fallbacks.
// Returns the product-default RelateOS brand if the org row is missing or
// the query errors (fail-open — branding must never block the app).
export async function getBrand(orgId: string | null | undefined): Promise<ResolvedBrand> {
  if (!orgId) return resolveBrand(null);

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('organizations')
      .select(
        'id, name, brand_name, brand_initial, logo_url, theme_primary, theme_accent, theme_background'
      )
      .eq('id', orgId)
      .single();

    return resolveBrand((data as OrgBrand) ?? null);
  } catch {
    return resolveBrand(null);
  }
}
