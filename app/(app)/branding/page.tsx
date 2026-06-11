import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { BrandingForm } from './_components/branding-form';
import { PRODUCT, type OrgBrand } from '@/lib/brand/brand';

export default async function BrandingPage() {
  const { profile } = await getUser();
  if (!['super_admin','admin'].includes(profile.role)) redirect('/dashboard');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, brand_name, brand_initial, logo_url, theme_primary, theme_accent, theme_background'
    )
    .eq('id', profile.org_id)
    .single();

  const current = (org as OrgBrand) ?? null;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        kicker="Workspace settings"
        title="Your"
        highlight="Brand"
        description={`Make this workspace yours. Set a name, logo, and colors. Unset values fall back to ${PRODUCT.name}.`}
      />
      <BrandingForm
        current={{
          brand_name: current?.brand_name ?? '',
          brand_initial: current?.brand_initial ?? '',
          logo_url: current?.logo_url ?? '',
          theme_primary: current?.theme_primary ?? '',
          theme_accent: current?.theme_accent ?? '',
          theme_background: current?.theme_background ?? '',
          fallback_name: current?.name ?? PRODUCT.name,
        }}
      />
    </div>
  );
}
