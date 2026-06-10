// lib/brand/brand.ts
// RelateOS branding layer.
//
// Two-layer model:
//   - PRODUCT brand (RelateOS): fixed, shown on login / metadata / system emails.
//   - TENANT brand: per-organization, shown inside the workspace (sidebar chrome,
//     theme colors). Falls back to PRODUCT brand until a customer sets their own.

export const PRODUCT = {
  name: 'RelateOS',
  // Short label under the logo in-app and on login.
  tagline: 'CRM',
  // Single-letter logo glyph fallback.
  initial: 'R',
  url: 'https://relateos.org',
} as const;

export type OrgBrand = {
  id: string;
  name: string;
  // Branding (all nullable — null means "use product fallback").
  brand_name: string | null;
  brand_initial: string | null;
  logo_url: string | null;
  theme_primary: string | null;     // hex, e.g. "#E0703A"
  theme_accent: string | null;      // hex
  theme_background: string | null;  // hex
};

// What the UI actually renders, after applying fallbacks.
export type ResolvedBrand = {
  name: string;
  initial: string;
  tagline: string;
  logoUrl: string | null;
  primaryHex: string | null;
  accentHex: string | null;
  backgroundHex: string | null;
};

export function resolveBrand(org: Partial<OrgBrand> | null | undefined): ResolvedBrand {
  const name = (org?.brand_name || '').trim() || PRODUCT.name;
  const initial =
    (org?.brand_initial || '').trim().slice(0, 1).toUpperCase() ||
    name.slice(0, 1).toUpperCase() ||
    PRODUCT.initial;

  return {
    name,
    initial,
    tagline: PRODUCT.tagline,
    logoUrl: org?.logo_url?.trim() || null,
    primaryHex: org?.theme_primary?.trim() || null,
    accentHex: org?.theme_accent?.trim() || null,
    backgroundHex: org?.theme_background?.trim() || null,
  };
}

// --- Color conversion -------------------------------------------------------
// The theme is authored in oklch CSS vars. Customers pick colors as hex.
// We convert hex -> oklch at inject time so a single picked color drives the
// same token the rest of the UI already consumes (--primary, --accent, etc).

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '');
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  return null;
}

// Returns an oklch() string like "oklch(0.67 0.18 38)" or null if hex invalid.
export function hexToOklch(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);

  // linear sRGB -> LMS (OKLab matrix)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;

  const round = (n: number, p = 4) => {
    const f = Math.pow(10, p);
    return Math.round(n * f) / f;
  };

  return `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 2)})`;
}

// Lighter/darker variants for foreground contrast on a primary fill.
// We keep it simple: white foreground on saturated primaries reads well in this
// dark theme, matching the existing --primary-foreground: oklch(0.99 0 0).

// Like hexToOklch but returns just the "L C H" triplet (no oklch() wrapper, no
// alpha) for use in the --glow variable: oklch(var(--glow) / 0.7).
export function hexToOklchTriplet(hex: string): string | null {
  const full = hexToOklch(hex);
  if (!full) return null;
  // strip "oklch(" and ")"
  const inner = full.slice(full.indexOf('(') + 1, full.lastIndexOf(')'));
  return inner.trim();
}
