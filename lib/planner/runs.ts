/**
 * Turning a pile of doors into a walk somebody will actually do.
 *
 * The offer has to answer three questions in one line - where, how many, how
 * long - because a rep decides in about two seconds whether to tap it. Nothing
 * here needs a routing API: straight-line distance is plenty for deciding
 * whether twelve shops are close enough to walk, and the Places budget should
 * not be spent on arithmetic.
 */

export type Door = {
  accountId: string;
  name: string;
  vertical: string;
  city: string | null;
  address: string | null;
  lat: number;
  lng: number;
  band: string;
  cryptoScore: number | null;
  ownerId: string | null;
  lastActivityAt: string | null;
  lastEngagedAt: string | null;
};

export type Run = {
  label: string;
  doors: Door[];
  /** Walking plus talking, rounded to something a rep can plan around. */
  estMinutes: number;
  centerLat: number;
  centerLng: number;
  /** Why this one is worth the trip. One line, shown on the offer. */
  reason: string;
  score: number;
  claimable: number;
};

const R_MILES = 3958.8;

export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(s));
}

/** The dominant street across a cluster's addresses. Reps think in streets. */
export function streetName(doors: Door[]): string | null {
  const counts = new Map<string, number>();
  for (const d of doors) {
    if (!d.address) continue;
    // "8123 N 83rd Ave, Peoria AZ" -> "N 83rd Ave"
    const first = d.address.split(',')[0].trim();
    const street = first.replace(/^[0-9-]+\s+/, '').trim();
    if (street.length < 3) continue;
    counts.set(street, (counts.get(street) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [s, n] of counts) {
    if (n > bestN) {
      best = s;
      bestN = n;
    }
  }
  // One shop on a street is not a street worth naming the walk after.
  return bestN >= 2 ? best : null;
}

/**
 * Grid buckets, then merge neighbours.
 *
 * Deliberately not k-means: the number of clusters is not known ahead of time
 * and a rep does not want the map carved evenly, they want the pockets where
 * doors happen to sit close together.
 */
export function clusterDoors(doors: Door[], cellMiles = 0.35): Door[][] {
  const cell = cellMiles / 69; // rough degrees of latitude per mile
  const buckets = new Map<string, Door[]>();
  for (const d of doors) {
    const key = `${Math.round(d.lat / cell)}:${Math.round(d.lng / cell)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(d);
    else buckets.set(key, [d]);
  }

  // Merge into 8-neighbours so a pocket straddling a grid line is not split
  // into two runs that are really one walk.
  const seen = new Set<string>();
  const clusters: Door[][] = [];
  for (const key of buckets.keys()) {
    if (seen.has(key)) continue;
    const [gx, gy] = key.split(':').map(Number);
    const queue = [key];
    const group: Door[] = [];
    seen.add(key);
    while (queue.length) {
      const k = queue.pop()!;
      group.push(...(buckets.get(k) ?? []));
      const [x, y] = k.split(':').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nk = `${x + dx}:${y + dy}`;
          if (!seen.has(nk) && buckets.has(nk)) {
            seen.add(nk);
            queue.push(nk);
          }
        }
      }
    }
    void gx;
    void gy;
    clusters.push(group);
  }
  return clusters;
}

/** Nearest neighbour, then a 2-opt pass. Optimal enough under about 20 stops. */
export function orderStops(doors: Door[], startLat?: number, startLng?: number): Door[] {
  if (doors.length < 3) return doors;
  const left = [...doors];
  const path: Door[] = [];
  let curLat = startLat ?? doors[0].lat;
  let curLng = startLng ?? doors[0].lng;

  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = milesBetween(curLat, curLng, left[i].lat, left[i].lng);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const next = left.splice(bi, 1)[0];
    path.push(next);
    curLat = next.lat;
    curLng = next.lng;
  }

  const legs = (p: Door[]) => {
    let t = 0;
    for (let i = 1; i < p.length; i++) t += milesBetween(p[i - 1].lat, p[i - 1].lng, p[i].lat, p[i].lng);
    return t;
  };
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 40) {
    improved = false;
    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        const trial = [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
        if (legs(trial) < legs(path) - 0.001) {
          path.splice(0, path.length, ...trial);
          improved = true;
        }
      }
    }
  }
  return path;
}

const DAY = 86400000;

/**
 * Builds the offers.
 *
 * A run needs a REASON to exist beyond "here are some pins" - at least one
 * warm door or somebody who raised their hand. The cold doors around it are
 * what make the trip pay, which is the whole value-per-minute argument: they
 * are not worth a drive, they are worth a detour.
 */
export function buildRuns(
  doors: Door[],
  opts: {
    now: number;
    minDoors?: number;
    maxDoors?: number;
    max?: number;
    /** Ranks pockets near today's appointments first. */
    anchors?: { lat: number; lng: number }[];
  },
): Run[] {
  const minDoors = opts.minDoors ?? 6;
  const maxDoors = opts.maxDoors ?? 12;

  const runs: Run[] = [];
  for (const group of clusterDoors(doors)) {
    if (group.length < minDoors) continue;

    const ranked = [...group].sort((a, b) => doorValue(b, opts.now) - doorValue(a, opts.now));
    const picked = ranked.slice(0, maxDoors);

    const hot = picked.filter((d) => d.band === 'HOT').length;
    const warm = picked.filter((d) => d.band === 'WARM').length;
    const engaged = picked.filter(
      (d) => d.lastEngagedAt && opts.now - Date.parse(d.lastEngagedAt) < 14 * DAY,
    ).length;

    // No warm door, nobody engaged: that is a list of pins, not a reason to
    // spend two hours.
    if (hot + warm + engaged === 0) continue;

    const ordered = orderStops(picked);
    const centerLat = picked.reduce((n, d) => n + d.lat, 0) / picked.length;
    const centerLng = picked.reduce((n, d) => n + d.lng, 0) / picked.length;

    let walkMiles = 0;
    for (let i = 1; i < ordered.length; i++) {
      walkMiles += milesBetween(ordered[i - 1].lat, ordered[i - 1].lng, ordered[i].lat, ordered[i].lng);
    }
    // 10 minutes a door, 20 minutes a mile on foot, rounded to a quarter hour
    // so the number reads like a plan rather than an estimate.
    const raw = ordered.length * 10 + walkMiles * 20;
    const estMinutes = Math.max(30, Math.round(raw / 15) * 15);

    const street = streetName(picked);
    const city = picked.find((d) => d.city)?.city ?? null;
    const label = street ? `${street}${city ? `, ${city}` : ''}` : city ? `Around ${city}` : 'Nearby doors';

    const bits: string[] = [];
    if (engaged) bits.push(`${engaged} opened their page recently`);
    if (hot) bits.push(`${hot} hot`);
    if (warm) bits.push(`${warm} warm`);
    const claimable = picked.filter((d) => !d.ownerId).length;
    if (claimable) bits.push(`${claimable} unclaimed`);

    let score = engaged * 40 + hot * 20 + warm * 8 + picked.length;
    if (opts.anchors?.length) {
      const nearest = Math.min(
        ...opts.anchors.map((a) => milesBetween(a.lat, a.lng, centerLat, centerLng)),
      );
      // Being near where you already have to be is worth more than being
      // slightly denser somewhere across town.
      if (nearest < 5) score += (5 - nearest) * 15;
    }

    runs.push({
      label,
      doors: ordered,
      estMinutes,
      centerLat,
      centerLng,
      reason: bits.join(' · '),
      score,
      claimable,
    });
  }

  return runs.sort((a, b) => b.score - a.score).slice(0, opts.max ?? 3);
}

function doorValue(d: Door, now: number): number {
  let v = d.band === 'HOT' ? 60 : d.band === 'WARM' ? 30 : 0;
  if (d.lastEngagedAt && now - Date.parse(d.lastEngagedAt) < 14 * DAY) v += 80;
  v += Math.round((d.cryptoScore ?? 0) / 5);
  if (!d.lastActivityAt) v += 10; // never touched beats touched and gone quiet
  return v;
}
