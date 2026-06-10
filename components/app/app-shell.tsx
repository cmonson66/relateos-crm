'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/app/sidebar';
import { Header } from '@/components/app/header';
import type { Profile } from '@/lib/auth/get-user';
import type { ResolvedBrand } from '@/lib/brand/brand';

export function AppShell({
  profile,
  brand,
  children,
}: {
  profile: Profile;
  brand: ResolvedBrand;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        profile={profile}
        brand={brand}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          profile={profile}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
