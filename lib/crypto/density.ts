// lib/crypto/density.ts
//
// Client-side mirror of the scraper's crypto/score.js. Same radius, same
// quadratic falloff, same midrank percentile — so a number shown in a map
// popup matches what score.js writes to leads.crypto_score for the same
// address. If you change one, change the other.

export type CryptoSignal = {
  id: number;
  signal_type: 'atm' | 'merchant';
  name: string | null;
  brand: string | null;
  city: string | null;
  lat: number;
  lng: number;
  weight: number;
};

export type CryptoStats = {
  score: number; // 0 = nothing in range, 1-100 = percentile among the rest
  atmCount: number;
  merchantCount: number;
  nearestAtmM: number | null;
};

export const CRYPTO_RADIUS_M = 2400; // ~1.5 mi
const FALLOFF_POWER = 2;
const R_EARTH_M = 6371008.8;

const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatDistance(m: number | null): string {
  if (m === null) return '—';
  return m < 1609 ? `${Math.round(m)} m` : `${(m / 1609.34).toFixed(1)} mi`;
}

type Point = { id: string; lat: number; lng: number };

/**
 * Uniform lat/lng grid keyed to the query radius, so every in-range signal
 * is guaranteed to sit in the 3x3 block around the point. Keeps this an
 * O(n) pass instead of accounts x signals.
 */
function buildGrid(signals: CryptoSignal[], radiusM: number, refLat: number) {
  const cellLat = radiusM / 111320;
  const cellLng = radiusM / (111320 * Math.cos(toRad(refLat)));
  const cells = new Map<string, CryptoSignal[]>();

  for (const s of signals) {
    const key = `${Math.floor(s.lat / cellLat)}:${Math.floor(s.lng / cellLng)}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(s);
    else cells.set(key, [s]);
  }

  return (lat: number, lng: number): CryptoSignal[] => {
    const gi = Math.floor(lat / cellLat);
    const gj = Math.floor(lng / cellLng);
    const out: CryptoSignal[] = [];
    for (let i = gi - 1; i <= gi + 1; i++) {
      for (let j = gj - 1; j <= gj + 1; j++) {
        const bucket = cells.get(`${i}:${j}`);
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  };
}

/** Midrank percentile over the non-zero raw scores. */
function percentileRanks(values: number[]): Map<number, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const map = new Map<number, number>();
  let i = 0;
  while (i < n) {
    const v = sorted[i];
    let j = i;
    while (j < n && sorted[j] === v) j++;
    const pct = (i + (j - i) / 2) / n;
    map.set(v, Math.max(1, Math.round(pct * 100)));
    i = j;
  }
  return map;
}

export function computeCryptoStats(
  points: Point[],
  signals: CryptoSignal[],
  radiusM: number = CRYPTO_RADIUS_M
): Map<string, CryptoStats> {
  const out = new Map<string, CryptoStats>();
  if (points.length === 0 || signals.length === 0) return out;

  const refLat = points[0].lat;
  const near = buildGrid(signals, radiusM, refLat);

  const raws: Array<{ id: string; raw: number; stats: Omit<CryptoStats, 'score'> }> = [];

  for (const p of points) {
    let raw = 0;
    let atmCount = 0;
    let merchantCount = 0;
    let nearestAtmM: number | null = null;

    for (const s of near(p.lat, p.lng)) {
      const d = haversineMeters(p.lat, p.lng, s.lat, s.lng);
      if (d >= radiusM) continue;

      if (s.signal_type === 'atm') {
        atmCount++;
        if (nearestAtmM === null || d < nearestAtmM) nearestAtmM = d;
      } else {
        merchantCount++;
      }

      raw += (Number(s.weight) || 1) * (1 - Math.pow(d / radiusM, FALLOFF_POWER));
    }

    raws.push({ id: p.id, raw, stats: { atmCount, merchantCount, nearestAtmM } });
  }

  const ranks = percentileRanks(raws.filter(r => r.raw > 0).map(r => r.raw));
  for (const r of raws) {
    out.set(r.id, { score: r.raw > 0 ? (ranks.get(r.raw) ?? 0) : 0, ...r.stats });
  }

  return out;
}

/** Shared violet-to-magenta ramp. Band pins own red, amber and slate. */
export const HEAT_GRADIENT: Record<number, string> = {
  0.2: '#3b1d6e',
  0.4: '#7b2fbe',
  0.6: '#b93fd0',
  0.8: '#e85ac0',
  1.0: '#ff7ad9',
};

export const ATM_COLOR = '#ff7ad9';
export const MERCHANT_COLOR = '#22d3ee';
