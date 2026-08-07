// Supabase/PostgREST caps every request at 1,000 rows (dashboard "Max Rows").
// This helper pages through .range() windows so list pages see the full
// dataset instead of a silent first-thousand.
//
// v2: pages are fetched in PARALLEL. The serial version cost one network
// round-trip per 1,000 rows — at ~28K rows that was ~28 sequential hops
// (multi-second page loads). Now: one probe request, then every remaining
// page in flight at once. Order is preserved by page index, and callers'
// stable .order() clauses (with the id tiebreaker) keep windows consistent.

const PAGE = 1000;
const MAX_PAGES = 50;
const BATCH = 10; // concurrent requests per wave — polite to PostgREST

type RangeQuery<T> = (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllRows<T>(build: RangeQuery<T>): Promise<T[]> {
  // Probe: first page tells us whether there's more
  const first = await build(0, PAGE - 1);
  if (first.error) {
    console.error('fetchAllRows:', first.error.message);
    return [];
  }
  const all: T[][] = [first.data ?? []];
  if ((first.data?.length ?? 0) < PAGE) return all[0];

  // Fan out the rest in waves until a short/empty page appears
  let page = 1;
  let done = false;
  while (!done && page < MAX_PAGES) {
    const wave = Array.from(
      { length: Math.min(BATCH, MAX_PAGES - page) },
      (_, i) => page + i
    );
    const results = await Promise.all(
      wave.map(async (p) => {
        const from = p * PAGE;
        const res = await build(from, from + PAGE - 1);
        if (res.error) {
          console.error('fetchAllRows:', res.error.message);
          return { p, rows: [] as T[] };
        }
        return { p, rows: res.data ?? [] };
      })
    );
    for (const { p, rows } of results) {
      all[p] = rows;
      if (rows.length < PAGE) done = true;
    }
    page += wave.length;
  }
  return all.flat();
}
