/**
 * Page sizing for the search results.
 *
 * The main query carries ~15 correlated subqueries per row (translated titles,
 * characters, hero, subseries, …), so its cost scales linearly with the page
 * size — and it runs in SQLite compiled to WASM, in the browser. 24 keeps the
 * first paint quick on modest hardware; readers who would rather scroll than
 * paginate can raise it from the results toolbar.
 */
export const DEFAULT_ROWS_PER_PAGE = 24

export const ROWS_PER_PAGE_OPTIONS = [24, 50, 100]

/** Reads a page size off a filters object, tolerating absent or junk values. */
export function resolveRowsPerPage(value: unknown): number {
  return Math.max(1, parseInt(String(value || DEFAULT_ROWS_PER_PAGE), 10) || DEFAULT_ROWS_PER_PAGE)
}
