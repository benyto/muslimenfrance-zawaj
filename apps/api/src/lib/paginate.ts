const PAGE_SIZE = 1000;

type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
};

/**
 * Reads every row of a query, a page at a time.
 *
 * PostgREST silently caps a response at its `max_rows` setting (1000 by
 * default, and configurable per project), so a plain `select` on a long
 * history just returns the first slice and no error. This asks for the exact
 * total with each page, advances by however many rows actually came back
 * (the cap may be smaller than PAGE_SIZE), and throws if it ends up with fewer
 * rows than the total — a loud failure instead of a quietly incomplete result.
 *
 * `page` must apply a stable total order (e.g. created_at then id) and
 * request `{ count: "exact" }`; without an order, pages can overlap or skip.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<Page<T>>
): Promise<T[]> {
  const rows: T[] = [];
  let total = Number.POSITIVE_INFINITY;

  while (rows.length < total) {
    const { data, error, count } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(`read failed: ${error.message}`);
    if (count === null) throw new Error("read failed: the query did not return a row count");
    // Re-read each time: rows may be added or removed while we page.
    total = count;
    if (!data || data.length === 0) break;
    rows.push(...data);
  }

  if (rows.length < total) {
    throw new Error(`incomplete read: got ${rows.length} of ${total} rows`);
  }
  return rows;
}
