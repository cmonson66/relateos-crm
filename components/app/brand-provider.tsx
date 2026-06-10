// components/app/brand-provider.tsx
'use client';

import { createContext, useContext } from 'react';
import type { ResolvedBrand } from '@/lib/brand/brand';
import { hexToOklch } from '@/lib/brand/brand';

const BrandContext = createContext<ResolvedBrand | null>(null);

export function useBrand(): ResolvedBrand {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    // Defensive fallback — should never hit because layout always provides it.
    return {
      name: 'RelateOS',
      initial: 'R',
      tagline: 'CRM',
      logoUrl: null,
      primaryHex: null,
      accentHex: null,
      backgroundHex: null,
    };
  }
  return ctx;
}

// Builds the CSS variable override block from picked hex colors.
// Only emits vars for colors the customer actually set; everything else keeps
// the authored defaults in globals.css.
function buildThemeStyle(brand: ResolvedBrand): string | null {
  const lines: string[] = [];

  if (brand.primaryHex) {
    const oklch = hexToOklch(brand.primaryHex);
    if (oklch) {
      lines.push(`--primary: ${oklch};`);
      lines.push(`--ring: ${oklch};`);
      lines.push(`--sidebar-primary: ${oklch};`);
      lines.push(`--sidebar-ring: ${oklch};`);
      lines.push(`--chart-1: ${oklch};`);
    }
  }
  if (brand.accentHex) {
    const oklch = hexToOklch(brand.accentHex);
    if (oklch) {
      lines.push(`--accent: ${oklch};`);
    }
  }
  if (brand.backgroundHex) {
    const oklch = hexToOklch(brand.backgroundHex);
    if (oklch) {
      lines.push(`--background: ${oklch};`);
    }
  }

  if (lines.length === 0) return null;
  return `:root{${lines.join('')}}`;
}

export function BrandProvider({
  brand,
  children,
}: {
  brand: ResolvedBrand;
  children: React.ReactNode;
}) {
  const themeCss = buildThemeStyle(brand);

  return (
    <BrandContext.Provider value={brand}>
      {themeCss && (
        // eslint-disable-next-line react/no-danger
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      )}
      {children}
    </BrandContext.Provider>
  );
}
