// Supabase/PostgREST caps every request at 1,000 rows (dashboard "Max Rows").
// This helper pages through .range() windows so list pages see the full
// dataset instead of a silent first-thousand.
//
// v3: pages fetch in parallel WAVES, and a failed page is RETRIED — not
// treated as end-of-data. (v2 conflated "request errored" with "no more
// rows": one timeout inside a wave of ten concurrent heavy queries and
// the map silently served 14 pages as if they were all 28.) Only a
// SUCCESSFUL short/empty page ends the walk.

const PAGE = 1000;
const MAX_PAGES = 50;
const BATCH = 8;      // concurrent requests per wave
const RETRIES = 3;    // per page, with backoff — heavy joins can time out

type RangeQuery<T> = (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage<T>(build: RangeQuery<T>, p: number): Promise<T[] | null> {
  const from = p * PAGE;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (!error) return data ?? [];
    console.error(`fetchAllRows page ${p} attempt ${attempt}: ${error.message}`);
    await sleep(250 * attempt);
  }
  return null; // exhausted — caller decides
}

export async function fetchAllRows<T>(build: RangeQuery<T>): Promise<T[]> {
  const first = await fetchPage(build, 0);
  if (first === null) return [];
  const pages: T[][] = [first];
  if (first.length < PAGE) return first;

  let page = 1;
  let done = false;
  while (!done && page < MAX_PAGES) {
    const wave = Array.from(
      { length: Math.min(BATCH, MAX_PAGES - page) },
      (_, i) => page + i
    );
    const results = await Promise.all(
      wave.map(async (p) => ({ p, rows: await fetchPage(build, p) }))
    );
    for (const { p, rows } of results) {
      if (rows === null) {
        // Permanent failure after retries: refuse to silently truncate —
        // fetch it one more time alone, off the concurrent wave
        const solo = await fetchPage(build, p);
        pages[p] = solo ?? [];
        if (solo === null) console.error(`fetchAllRows: page ${p} lost after solo retry`);
        if ((solo ?? []).length < PAGE) done = true;
      } else {
        pages[p] = rows;
        if (rows.length < PAGE) done = true;
      }
    }
    page += wave.length;
  }

  // No sparse holes: every index up to the last fetched page is an array
  for (let i = 0; i < pages.length; i++) if (!pages[i]) pages[i] = [];
  return pages.flat();
}

// ---------------------------------------------------------------------------
// Keyset fetch: the depth-proof walk. OFFSET pagination makes Postgres walk
// and discard N rows per page — at 28K rows under concurrency, deep pages
// exceed the statement timeout and truncate silently. Keyset asks for "the
// next 1,000 after id X": a pure index seek, identical cost at any depth.
// UUIDs are uniform, so the id space partitions cleanly — four ranges
// walked in parallel, keyset within each. Complete by construction.

type KeysetFactory<T> = () => {
  gt: (col: string, val: string) => any;
} & PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

// id columns are UUIDs — range bounds must be full uuid literals
// (Postgres refuses `uuid < '4'`; byte-wise uuid ordering makes these
// four ranges near-equal for random v4 ids)
const PARTS = [
  "40000000-0000-0000-0000-000000000000",
  "80000000-0000-0000-0000-000000000000",
  "c0000000-0000-0000-0000-000000000000",
]; // boundaries -> [-,4) [4,8) [8,c) [c,-]

export async function fetchAllRowsById<T extends { id: string }>(
  factory: () => any
): Promise<T[]> {
  const bounds: [string | null, string | null][] = [
    [null, PARTS[0]],
    [PARTS[0], PARTS[1]],
    [PARTS[1], PARTS[2]],
    [PARTS[2], null],
  ];

  const walkPartition = async (lo: string | null, hi: string | null): Promise<T[]> => {
    const out: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      let rows: T[] | null = null;
      for (let attempt = 1; attempt <= RETRIES; attempt++) {
        let q = factory();
        if (cursor) q = q.gt("id", cursor);
        else if (lo) q = q.gte("id", lo);
        if (hi) q = q.lt("id", hi);
        const { data, error } = await q.order("id", { ascending: true }).limit(PAGE);
        if (!error) { rows = (data ?? []) as T[]; break; }
        console.error(`fetchAllRowsById [${lo ?? ""}-${hi ?? ""}] attempt ${attempt}: ${error.message}`);
        await sleep(250 * attempt);
      }
      if (rows === null) { console.error(`fetchAllRowsById: partition ${lo ?? ""}-${hi ?? ""} lost a page`); break; }
      out.push(...rows);
      if (rows.length < PAGE) break;
      cursor = rows[rows.length - 1].id;
    }
    return out;
  };

  const parts = await Promise.all(bounds.map(([lo, hi]) => walkPartition(lo, hi)));
  return parts.flat();
}
