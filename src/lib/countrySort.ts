/**
 * Shared sort criterion for the countries/publications browser.
 *
 * The "most issues" sort used to only reorder the publications *inside* a
 * country page while the country list stayed alphabetical. Both screens now
 * read the same persisted criterion, so activating it on either one also
 * reorders the countries themselves — the country whose biggest publication
 * has the most issues comes first (Brazil before Greece, say).
 */

export const PUBLICATION_SORT_STORAGE_KEY = "inducks_publication_sort";

/** The one sort mode that must also bubble up to the country grouping. */
export function isMostIssuesSort(mode: string | null | undefined): boolean {
  return mode === "issues_desc";
}

export function loadStoredPublicationSort(fallback: string): string {
  try {
    return localStorage.getItem(PUBLICATION_SORT_STORAGE_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export function storePublicationSort(mode: string): void {
  try {
    localStorage.setItem(PUBLICATION_SORT_STORAGE_KEY, mode);
  } catch {
    // Private browsing: the sort simply won't survive a reload.
  }
}

export interface CountrySortable {
  countryname: string;
  /** Issue count of the country's biggest publication. */
  maxIssueCount?: number | null;
}

/**
 * Orders the country list: alphabetical by default, by max(issue count of
 * their publications) descending when the "most issues" sort is active.
 * Ties (and countries with no count) fall back to the alphabetical order.
 */
export function sortCountries<T extends CountrySortable>(countries: T[], mode: string): T[] {
  const sorted = [...countries].sort((a, b) => a.countryname.localeCompare(b.countryname));
  if (!isMostIssuesSort(mode)) return sorted;
  return sorted.sort((a, b) => (b.maxIssueCount ?? 0) - (a.maxIssueCount ?? 0));
}
