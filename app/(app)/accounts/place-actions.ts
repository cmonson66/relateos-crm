'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Turning a typed address into something the app can actually use.
 *
 * A hand-added account with no coordinates is invisible to the map and can
 * never appear in a canvas run - the two features a rep uses to find doors. So
 * an address field on its own would not have fixed anything; it has to resolve
 * to a point.
 *
 * Places rather than plain geocoding, because the response carries the place
 * id. That is what lets a later scrape recognise a shop somebody typed in by
 * hand instead of creating a second copy of it.
 */

export type PlaceHit = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type NearbyWarning = {
  accountId: string;
  name: string;
  address: string | null;
  metres: number;
  ownerName: string | null;
  samePlace: boolean;
};

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

/** Straight-line metres. Good enough to tell "same building" from "not". */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(s)));
}

export async function lookupPlace(query: string): Promise<Result<{ hits: PlaceHit[] }>> {
  try {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      return {
        ok: false,
        message: 'Address lookup is not configured yet. Add GOOGLE_PLACES_API_KEY in Vercel.',
      };
    }
    const text = query.trim();
    if (text.length < 4) return { ok: false, message: 'Give it a bit more to go on.' };

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // Field mask keeps this on the cheap tier. Asking for extra fields
        // here would multiply the per-lookup cost for data nothing uses.
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({ textQuery: text, maxResultCount: 5 }),
    });

    if (!res.ok) {
      return { ok: false, message: `Lookup failed (${res.status}). Try the full address.` };
    }
    const data = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
      }[];
    };

    const hits: PlaceHit[] = (data.places ?? [])
      .filter((p) => p.location)
      .map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? text,
        address: p.formattedAddress ?? '',
        lat: p.location!.latitude,
        lng: p.location!.longitude,
      }));

    if (hits.length === 0) return { ok: false, message: 'Nothing found. Check the address.' };
    return { ok: true, hits };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Lookup failed.' };
  }
}

/**
 * Anything already in the book at this spot.
 *
 * Chains are exactly where duplicates get made, and a duplicate splits the
 * history so neither record tells the truth about whether this shop already
 * said no. Proximity is the reliable signal - two records at the same address
 * are the same shop whatever they are called.
 */
export async function checkForDuplicate(hit: {
  placeId: string;
  lat: number;
  lng: number;
  name: string;
}): Promise<Result<{ warnings: NearbyWarning[] }>> {
  try {
    const supabase = await createClient();

    // Same place id is not a warning, it is the same shop.
    const { data: exact } = await supabase
      .from('accounts')
      .select('id, name, address, owner:profiles!accounts_owner_id_fkey(full_name)')
      .eq('place_id', hit.placeId)
      .limit(1);

    const warnings: NearbyWarning[] = [];
    for (const a of (exact ?? []) as Record<string, unknown>[]) {
      const o = (Array.isArray(a.owner) ? a.owner[0] : a.owner) as { full_name: string | null } | undefined;
      warnings.push({
        accountId: a.id as string,
        name: a.name as string,
        address: (a.address as string) ?? null,
        metres: 0,
        ownerName: o?.full_name ?? null,
        samePlace: true,
      });
    }

    if (warnings.length === 0) {
      // Roughly a quarter mile box, then measured properly in JS. A box is
      // cheap for the database; the circle is what we actually mean.
      const pad = 0.004;
      const { data: near } = await supabase
        .from('accounts')
        .select('id, name, address, latitude, longitude, owner:profiles!accounts_owner_id_fkey(full_name)')
        .gte('latitude', hit.lat - pad)
        .lte('latitude', hit.lat + pad)
        .gte('longitude', hit.lng - pad)
        .lte('longitude', hit.lng + pad)
        .limit(40);

      for (const a of (near ?? []) as Record<string, unknown>[]) {
        const m = metresBetween(hit.lat, hit.lng, a.latitude as number, a.longitude as number);
        if (m > 150) continue;
        const o = (Array.isArray(a.owner) ? a.owner[0] : a.owner) as { full_name: string | null } | undefined;
        warnings.push({
          accountId: a.id as string,
          name: a.name as string,
          address: (a.address as string) ?? null,
          metres: m,
          ownerName: o?.full_name ?? null,
          samePlace: false,
        });
      }
    }

    return { ok: true, warnings };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not check for duplicates.' };
  }
}

/** Other locations of the same brand, for the franchise conversation. */
export async function siblingLocations(accountId: string): Promise<
  Result<{ siblings: { id: string; name: string; city: string | null; isCustomer: boolean; band: string }[] }>
> {
  try {
    const supabase = await createClient();
    const { data: self } = await supabase
      .from('accounts')
      .select('brand_key')
      .eq('id', accountId)
      .maybeSingle();
    if (!self?.brand_key) return { ok: true, siblings: [] };

    const { data } = await supabase
      .from('accounts')
      .select('id, name, city, tags, deals(id, stage_id)')
      .eq('brand_key', self.brand_key)
      .neq('id', accountId)
      .limit(12);

    const siblings = ((data ?? []) as Record<string, unknown>[]).map((a) => {
      const tags = (a.tags ?? []) as string[];
      return {
        id: a.id as string,
        name: a.name as string,
        city: (a.city as string) ?? null,
        isCustomer: ((a.deals ?? []) as unknown[]).length > 0,
        band: tags.find((t) => t === 'HOT' || t === 'WARM' || t === 'COOL') ?? 'COOL',
      };
    });

    return { ok: true, siblings };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not load other locations.' };
  }
}
