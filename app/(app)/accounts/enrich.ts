'use server';

// The manual-account bridge: match a hand-entered account to the real
// business on Google Places, then hand it to link_account_to_lead (037),
// which mints the lead row and lets the normal sync machinery light up
// the map pin, band tags, and crypto density - same path as scraped leads.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type EnrichResult =
  | { status: 'linked'; cryptoScore: number | null }
  | { status: 'duplicate'; accountId: string }
  | { status: 'no-match' }
  | { status: 'skipped'; reason: string };

function similar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (ta.size === 0 || tb.size === 0) return false;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size) >= 0.5;
}

export async function enrichAccount(accountId: string): Promise<EnrichResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { status: 'skipped', reason: 'GOOGLE_PLACES_API_KEY not set' };

  const supabase = await createClient();
  const { data: account } = await supabase
    .from('accounts')
    .select('id, name, city, state')
    .eq('id', accountId)
    .maybeSingle();
  if (!account) return { status: 'skipped', reason: 'account not found' };

  const query = `${account.name}, ${account.city ?? ''} ${account.state ?? 'AZ'}`.trim();
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 3 }),
  });
  if (!res.ok) {
    console.error('places search:', res.status, await res.text());
    return { status: 'skipped', reason: 'places error' };
  }
  const json = await res.json();
  const hit = (json.places ?? []).find((p: { displayName?: { text?: string } }) =>
    similar(p.displayName?.text ?? '', account.name)
  ) ?? (json.places ?? [])[0];
  if (!hit?.id || !hit.location) return { status: 'no-match' };
  if (!similar(hit.displayName?.text ?? '', account.name)) return { status: 'no-match' };

  const { data, error } = await supabase.rpc('link_account_to_lead', {
    p_account_id: accountId,
    p: {
      place_id: hit.id,
      name: hit.displayName?.text ?? account.name,
      address: hit.formattedAddress ?? '',
      city: `${account.city ?? ''} AZ`.trim(),
      phone: hit.nationalPhoneNumber ?? '',
      website: hit.websiteUri ?? '',
      lat: hit.location.latitude,
      lng: hit.location.longitude,
      rating: hit.rating ?? null,
      review_count: hit.userRatingCount ?? 0,
    },
  });
  if (error) {
    console.error('link_account_to_lead:', error.message);
    return { status: 'skipped', reason: error.message };
  }
  const out = data as { linked?: boolean; duplicate_of?: string; crypto_score?: number };
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath('/accounts');
  revalidatePath('/map');
  if (out?.duplicate_of) return { status: 'duplicate', accountId: out.duplicate_of };
  return { status: 'linked', cryptoScore: out?.crypto_score ?? null };
}

// Form-action wrapper for the account detail header button
export async function enrichFromDetail(accountId: string): Promise<void> {
  await enrichAccount(accountId);
}
