import { getUser } from '@/lib/auth/get-user';
import { getBrand } from '@/lib/brand/get-brand';
import { AppShell } from '@/components/app/app-shell';
import { BrandProvider } from '@/components/app/brand-provider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getUser();
  const brand = await getBrand(profile.org_id);
  return (
    <BrandProvider brand={brand}>
      <AppShell profile={profile} brand={brand}>{children}</AppShell>
    </BrandProvider>
  );
}
