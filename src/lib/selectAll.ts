/**
 * Paged reads for PostgREST.
 *
 * A Supabase select with no `.range()` is capped server-side by `db-max-rows`
 * (1000 by default). Nothing errors — the response is simply short, so a report
 * computes cleanly over a fraction of the data. The analytics screens hit this:
 * shares whose latest price row fell past the cap resolved to a market price of
 * zero, and truncated cache reads left groups missing their final rows, so the
 * "last row" the totals are read from was not the last row at all.
 *
 * Pass a builder rather than a query. It is called once per page, because a
 * PostgREST builder is a thenable that can only be awaited once.
 *
 * The builder MUST impose a total order — an `.order()` on a unique column, or
 * a tiebreaker such as `id` after the sort columns. Paging over a non-unique
 * order lets rows shift between pages, which duplicates some and drops others.
 */

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

interface PageQuery<T> {
  range: (from: number, to: number) => PromiseLike<PageResult<T>>;
}

const DEFAULT_PAGE_SIZE = 1000;

/** Stops a mis-ordered query from paging forever. 500 pages ≈ 500k rows. */
const MAX_PAGES = 500;

export async function selectAll<T>(
  build: () => PageQuery<T>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * pageSize;
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    // A short page is the last page.
    if (data.length < pageSize) return rows;
  }

  return rows;
}
