// Supabase/PostgREST caps every request at 1,000 rows (dashboard "Max Rows").
// This helper pages through .range() windows so list pages see the full
// dataset instead of a silent first-thousand.

const PAGE = 1000;

type RangeQuery<T> = (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllRows<T>(build: RangeQuery<T>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE;
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) {
      console.error('fetchAllRows:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
