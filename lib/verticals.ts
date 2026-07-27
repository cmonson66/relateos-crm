// lib/verticals.ts
// Per-instance vertical configuration (white-label).
//
// Set NEXT_PUBLIC_VERTICALS in the deployment env to override, e.g.:
//   NEXT_PUBLIC_VERTICALS=smoke-vape:Smoke / Vape / CBD,tattoo:Tattoo & Piercing
// Format: comma-separated `value:Label` pairs. Values are what's stored in
// accounts.vertical; labels are what renders. When unset, the original
// RelateOS defaults apply, so existing instances are unaffected.

export type VerticalOption = { value: string; label: string; color: string };

// Order matters: the first six match the original hardcoded colors so
// default instances render pixel-identical.
const PALETTE = [
  'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'bg-red-500/15 text-red-300 border-red-500/30',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'bg-slate-500/15 text-slate-300 border-slate-500/30',
  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'bg-pink-500/15 text-pink-300 border-pink-500/30',
];

const FALLBACK_COLOR = 'bg-slate-500/15 text-slate-300 border-slate-500/30';

const DEFAULT_SPEC =
  'corporate:Corporate,sports:Sports,public_safety:Public Safety,military:Military,education:Education,other:Other';

function parseSpec(spec: string): VerticalOption[] {
  const options = spec
    .split(',')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map((pair, i) => {
      const idx = pair.indexOf(':');
      const value = (idx === -1 ? pair : pair.slice(0, idx)).trim();
      const label = (idx === -1 ? pair : pair.slice(idx + 1)).trim() || value;
      return { value, label, color: PALETTE[i % PALETTE.length] };
    })
    .filter(o => o.value.length > 0);
  return options.length > 0 ? options : parseSpec(DEFAULT_SPEC);
}

export const VERTICALS: VerticalOption[] = parseSpec(
  process.env.NEXT_PUBLIC_VERTICALS || DEFAULT_SPEC
);

export const DEFAULT_VERTICAL: string = VERTICALS[0].value;

export function verticalOption(value: string): VerticalOption | undefined {
  return VERTICALS.find(o => o.value === value);
}

export function verticalLabel(value: string): string {
  return verticalOption(value)?.label ?? value;
}

export function verticalColor(value: string): string {
  return verticalOption(value)?.color ?? FALLBACK_COLOR;
}
