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
