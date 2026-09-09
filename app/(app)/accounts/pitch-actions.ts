'use server';

import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

/**
 * Build a pitch deck for one account, or a group of them.
 *
 * WHAT THIS CAN AND CANNOT DO, because it matters for what a rep is shown.
 *
 * The businesses layer is real: crypto_native accounts carry coordinates, so
 * "how many places near you already take it" is computed here rather than
 * guessed. The cash-machine layer is not - nothing in accounts stores ATM
 * coordinates, only the counts an enrichment pass wrote. So a generated deck
 * ships an empty `atms` array and the deck hides that layer instead of
 * drawing nothing. Manuel's deck has 47 machines because those were pulled by
 * hand through Google Places; until that enrichment runs for everyone, a
 * generated deck is the businesses layer plus whatever counts are stored.
 */

const R_KM = 4.828; // three miles

type Row = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  vertical: string | null;
  latitude: number | null;
  longitude: number | null;
  crypto_atm_count: number | null;
  crypto_nearest_atm_m: number | null;
};

const SERVICE_VERTICALS = new Set([
  'barber', 'nail-beauty', 'tattoo', 'med-spa', 'auto', 'powersports', 'bike',
  'phone-repair', 'pool-landscape', 'gym-supps',
]);

/** Coarse category, used to answer "how many near you are like you". */
function kindOf(vertical: string | null): 'food' | 'service' | 'retail' {
  if (vertical === 'food-drink' || vertical === 'kava-kratom' || vertical === 'cigar-hookah') return 'food';
  if (vertical && SERVICE_VERTICALS.has(vertical)) return 'service';
  return 'retail';
}

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const p = Math.PI / 180;
  const x =
    Math.sin(((bLat - aLat) * p) / 2) ** 2 +
    Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(((bLng - aLng) * p) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

/** Short label for a location: the city, or the street, or the name. */
function labelFor(r: Row, all: Row[]): string {
  const sameCity = all.filter((x) => x.city === r.city).length > 1;
  if (r.city && !sameCity) return r.city.trim();
  const street = (r.address ?? '').split(',')[0].replace(/^\d+\s+/, '').trim();
  return street || r.city?.trim() || r.name;
}

export type BuildResult =
  | { ok: true; token: string; locations: number; merchants: number }
  | { ok: false; error: string };

export async function buildPitchDeck(input: {
  accountIds: string[];
  brand?: string;
  /** Shown on the cover and the closing slide. */
  repName?: string;
  repPhone?: string;
}): Promise<BuildResult> {
  const supabase = await createClient();

  const { data: me } = await supabase.auth.getUser();
  if (!me?.user) return { ok: false, error: 'Not signed in.' };

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, name, city, address, vertical, latitude, longitude, crypto_atm_count, crypto_nearest_atm_m')
    .in('id', input.accountIds);

  if (error) return { ok: false, error: error.message };
  const rows = (accounts ?? []) as Row[];
  if (rows.length === 0) return { ok: false, error: 'No accounts found.' };

  const located = rows.filter((r) => r.latitude != null && r.longitude != null);
  if (located.length === 0) {
    return {
      ok: false,
      error:
        'None of these accounts have coordinates, so the map would be empty. Sync the account from Google Places first.',
    };
  }

  // Every crypto-accepting business we know of, with a position.
  const { data: nativeRows } = await supabase
    .from('accounts')
    .select('id, name, city, vertical, latitude, longitude')
    .eq('crypto_native', true)
    .not('latitude', 'is', null)
    .limit(2000);

  const merchants = ((nativeRows ?? []) as Row[])
    .filter((m) => !input.accountIds.includes(m.id))
    .map((m) => ({
      n: m.name,
      c: m.city ?? '',
      k: kindOf(m.vertical),
      lat: m.latitude as number,
      lng: m.longitude as number,
    }));

  const locations = located.map((r) => {
    const lat = r.latitude as number;
    const lng = r.longitude as number;
    const near = merchants
      .map((m) => ({ m, d: km(lat, lng, m.lat, m.lng) }))
      .filter((x) => x.d <= R_KM)
      .sort((a, b) => a.d - b.d);

    return {
      label: labelFor(r, located),
      city: r.city?.trim() ?? '',
      addr: (r.address ?? '').split(',')[0].trim(),
      lat,
      lng,
      merch_5000: near.length,
      merch_food_5000: near.filter((x) => x.m.k === 'food').length,
      near_merch: near.slice(0, 4).map((x) => ({ n: x.m.n, k: x.m.k, m: Math.round(x.d * 1000) })),
      // Only include ATM figures the row actually carries.
      ...(r.crypto_atm_count != null ? { atm_1600: r.crypto_atm_count } : {}),
      ...(r.crypto_nearest_atm_m != null ? { nearest_m: r.crypto_nearest_atm_m } : {}),
    };
  });

  // Two picks: most crypto-accepting neighbours, and the emptiest patch. They
  // argue different things, which is the point of showing both.
  const byDensity = [...locations].sort((a, b) => b.merch_5000 - a.merch_5000);
  const busiest = byDensity[0];
  const emptiest = byDensity[byDensity.length - 1];

  const picks: {
    label: string; stat: string; stat_label: string;
    tone: 'amber' | 'green'; headline: string; body: string;
  }[] = [
    {
      label: busiest.label,
      stat: String(busiest.merch_5000),
      stat_label: 'businesses within three miles already take it',
      tone: 'amber',
      headline:
        busiest.merch_5000 > 0
          ? 'The habit already exists on this block.'
          : 'Nobody on this block takes it yet.',
      body:
        busiest.merch_5000 > 0
          ? `People near this location are already paying this way somewhere else. ${busiest.merch_food_5000 > 0 ? `${busiest.merch_food_5000} of them are places to eat, so the behaviour is not theoretical here.` : 'None of them are restaurants, so nobody has taken the food side of it.'}`
          : 'Which cuts both ways. There is nothing to copy, and nothing to compete with either. First one on the street gets asked about.',
    },
  ];

  if (locations.length > 1 && emptiest.label !== busiest.label) {
    picks.push({
      label: emptiest.label,
      stat: String(emptiest.merch_5000),
      stat_label: 'businesses within three miles take it',
      tone: 'green',
      headline: 'The other end of the test.',
      body: `Thinner around this one, which is why it is worth running alongside the first. If it works in both, it is not the neighbourhood carrying it.`,
    });
  }

  const brand = input.brand?.trim() || rows[0].name;
  const token = randomBytes(18).toString('base64url');

  const deck = {
    brand,
    // Drives the language on the deck - a brake shop should never be offered
    // free appetizers.
    vertical: rows[0].vertical ?? undefined,
    subtitle:
      locations.length > 1
        ? `${locations.length} locations. One payment lane that is closed in all of them.`
        : 'One payment lane that is closed today.',
    picks,
    reps: input.repName?.trim()
      ? [{ name: input.repName.trim(), phone: input.repPhone?.trim() ?? '', role: 'Your rep' }]
      : [],
    locations,
    atms: [] as never[],
    merchants,
  };

  const { error: insertError } = await supabase.from('pitch_decks').insert({
    token,
    account_ids: input.accountIds,
    deck,
    created_by: me.user.id,
    expires_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
  });

  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, token, locations: locations.length, merchants: merchants.length };
}
