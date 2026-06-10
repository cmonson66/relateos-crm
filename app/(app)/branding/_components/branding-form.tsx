'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LayoutDashboard, Building2, Users, Briefcase, RotateCcw } from 'lucide-react';
import { hexToOklch, PRODUCT } from '@/lib/brand/brand';
import { saveBranding } from '../actions';

type FormState = {
  brand_name: string;
  brand_initial: string;
  logo_url: string;
  theme_primary: string;
  theme_accent: string;
  theme_background: string;
  fallback_name: string;
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const isHexOrEmpty = (v: string) => v.trim() === '' || HEX_RE.test(v.trim());

// RelateOS authored defaults (from globals.css) for preview when unset.
const DEFAULTS = {
  primary: 'oklch(0.67 0.18 38)',
  background: 'oklch(0.135 0.008 240)',
  card: 'oklch(0.19 0.008 240)',
  foreground: 'oklch(0.94 0.005 60)',
  muted: 'oklch(0.62 0.01 60)',
};

export function BrandingForm({ current }: { current: FormState }) {
  const [form, setForm] = useState<FormState>(current);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  const previewName =
    form.brand_name.trim() || form.fallback_name || PRODUCT.name;
  const previewInitial =
    (form.brand_initial.trim() || previewName.charAt(0) || PRODUCT.initial)
      .toUpperCase()
      .slice(0, 1);

  const primaryOklch = useMemo(() => {
    if (form.theme_primary.trim() && HEX_RE.test(form.theme_primary.trim())) {
      return hexToOklch(form.theme_primary.trim()) || DEFAULTS.primary;
    }
    return DEFAULTS.primary;
  }, [form.theme_primary]);

  const bgOklch = useMemo(() => {
    if (form.theme_background.trim() && HEX_RE.test(form.theme_background.trim())) {
      return hexToOklch(form.theme_background.trim()) || DEFAULTS.background;
    }
    return DEFAULTS.background;
  }, [form.theme_background]);

  const colorsValid =
    isHexOrEmpty(form.theme_primary) &&
    isHexOrEmpty(form.theme_accent) &&
    isHexOrEmpty(form.theme_background);

  async function handleSave() {
    if (!colorsValid) {
      toast.error('Fix the color values first. Use hex like #E0703A.');
      return;
    }
    setSaving(true);
    try {
      await saveBranding({
        brand_name: form.brand_name || null,
        brand_initial: form.brand_initial || null,
        logo_url: form.logo_url || null,
        theme_primary: form.theme_primary || null,
        theme_accent: form.theme_accent || null,
        theme_background: form.theme_background || null,
      });
      toast.success('Branding saved. Refresh to see it across the app.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function resetToFallback() {
    setForm(prev => ({
      ...prev,
      brand_name: '',
      brand_initial: '',
      logo_url: '',
      theme_primary: '',
      theme_accent: '',
      theme_background: '',
    }));
    toast.message(`Cleared. Save to revert this workspace to ${PRODUCT.name} defaults.`);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      {/* --- Form --- */}
      <div className="card-lit rounded-md border border-border/40 p-6 space-y-6">
        <div className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Identity
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_name" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Brand name
            </Label>
            <Input
              id="brand_name"
              value={form.brand_name}
              maxLength={60}
              placeholder={`${PRODUCT.name} (fallback)`}
              onChange={e => set('brand_name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_initial" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Logo letter
            </Label>
            <Input
              id="brand_initial"
              value={form.brand_initial}
              maxLength={1}
              placeholder={previewName.charAt(0).toUpperCase()}
              className="w-16 text-center font-display text-lg"
              onChange={e => set('brand_initial', e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">Shown when no logo image is set.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo_url" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Logo image URL <span className="normal-case tracking-normal">(optional)</span>
            </Label>
            <Input
              id="logo_url"
              value={form.logo_url}
              placeholder="https://.../logo.png"
              onChange={e => set('logo_url', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">A square image works best. Overrides the logo letter.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Colors
          </div>

          <ColorField
            label="Primary"
            hint="Buttons, links, active nav, charts."
            value={form.theme_primary}
            onChange={v => set('theme_primary', v)}
          />
          <ColorField
            label="Accent"
            hint="Subtle highlights and hover states."
            value={form.theme_accent}
            onChange={v => set('theme_accent', v)}
          />
          <ColorField
            label="Background"
            hint="App background base. Leave dark for best contrast."
            value={form.theme_background}
            onChange={v => set('theme_background', v)}
          />
          <p className="text-xs text-muted-foreground/80">
            The signature {PRODUCT.name} glow stays constant across all brands.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving || !colorsValid}>
            {saving ? 'Saving...' : 'Save branding'}
          </Button>
          <Button variant="ghost" onClick={resetToFallback} disabled={saving}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to {PRODUCT.name}
          </Button>
        </div>
      </div>

      {/* --- Live preview --- */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 px-1">
          Live preview
        </div>
        <div
          className="rounded-md border border-border/40 overflow-hidden"
          style={{ background: bgOklch }}
        >
          {/* sidebar header mimic */}
          <div className="px-4 py-4 border-b border-white/5 flex items-center gap-3">
            {form.logo_url.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="" className="w-9 h-9 rounded-md object-cover glow-halo" />
            ) : (
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center font-display text-xl glow-halo"
                style={{ background: primaryOklch, color: 'oklch(0.99 0 0)' }}
              >
                {previewInitial}
              </div>
            )}
            <div>
              <div className="font-display text-lg tracking-wider leading-none" style={{ color: DEFAULTS.foreground }}>
                {previewName.toUpperCase()}
              </div>
              <div className="text-[8px] uppercase tracking-[0.25em] mt-1" style={{ color: DEFAULTS.muted }}>
                CRM
              </div>
            </div>
          </div>

          {/* nav mimic */}
          <div className="py-2">
            {[
              { icon: LayoutDashboard, label: 'Dashboard', active: true },
              { icon: Building2, label: 'Accounts', active: false },
              { icon: Users, label: 'Contacts', active: false },
              { icon: Briefcase, label: 'Deals', active: false },
            ].map((it, i) => {
              const Icon = it.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2 text-sm relative"
                  style={{ color: it.active ? DEFAULTS.foreground : DEFAULTS.muted }}
                >
                  {it.active && (
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[3px] glow-stripe-soft"
                      style={{ background: primaryOklch }}
                    />
                  )}
                  <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: it.active ? primaryOklch : undefined }} />
                  <span className="tracking-wide">{it.label}</span>
                </div>
              );
            })}
          </div>

          {/* button mimic */}
          <div className="px-4 py-4 border-t border-white/5">
            <div
              className="inline-flex items-center justify-center rounded-lg px-3 h-8 text-sm font-medium"
              style={{ background: primaryOklch, color: 'oklch(0.99 0 0)' }}
            >
              Primary action
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          Approximation. Save and refresh to apply across the whole workspace.
        </p>
      </div>
    </div>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = value.trim() === '' || HEX_RE.test(value.trim());
  // Native color input needs a valid 6-char hex; fall back to a neutral when empty/invalid.
  const swatch = HEX_RE.test(value.trim()) ? value.trim() : '#888888';

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={swatch}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="h-9 w-10 rounded-md border border-border/40 bg-transparent cursor-pointer p-0.5"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          placeholder="#RRGGBB (optional)"
          onChange={e => onChange(e.target.value)}
          aria-invalid={!valid}
          className="font-mono text-sm uppercase"
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {!valid && <p className="text-xs text-destructive">Use a hex value like #E0703A.</p>}
    </div>
  );
}
