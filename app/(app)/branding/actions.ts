'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type BrandingInput = {
  brand_name: string | null;
  brand_initial: string | null;
  logo_url: string | null;
  theme_primary: string | null;
  theme_accent: string | null;
  theme_background: string | null;
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function cleanHex(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t === '') return null;
  if (!HEX_RE.test(t)) throw new Error(`Invalid color: ${t}. Use hex like #E0703A.`);
  return t.toUpperCase();
}

function cleanText(v: string | null, max: number): string | null {
  if (!v) return null;
  const t = v.trim();
  return t === '' ? null : t.slice(0, max);
}

export async function saveBranding(input: BrandingInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles').select('role, org_id').eq('id', user.id).single();
  if (!profile || profile.role !== 'super_admin') {
    throw new Error('Super admin access required');
  }

  const updates = {
    brand_name: cleanText(input.brand_name, 60),
    brand_initial: cleanText(input.brand_initial, 1)?.toUpperCase() ?? null,
    logo_url: cleanText(input.logo_url, 500),
    theme_primary: cleanHex(input.theme_primary),
    theme_accent: cleanHex(input.theme_accent),
    theme_background: cleanHex(input.theme_background),
  };

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', profile.org_id);

  if (error) throw new Error(error.message);

  // Brand affects the whole app shell.
  revalidatePath('/', 'layout');
  revalidatePath('/branding');
}
