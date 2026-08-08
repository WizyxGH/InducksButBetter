/**
 * Pure subseries helpers: localized name choice and story ordering.
 *
 * A subseries carries one "official" (usually English) name on
 * `inducks_subseries` plus any number of localized names on
 * `inducks_subseriesname`, each optionally flagged preferred. The reference
 * site (subseries.php) shows the preferred name of the visitor's language and
 * falls back to the official one; the same priority is applied here.
 */

export interface SubseriesNameRow {
  languagecode: string;
  subseriesname: string;
  preferred?: string | null;
}

/**
 * Picks the display name: preferred name in the requested language, then any
 * name in that language, then any preferred name, then the official fallback.
 */
export function pickSubseriesName(
  names: SubseriesNameRow[] | null | undefined,
  lang: string,
  officialName: string
): string {
  const rows = (names ?? []).filter((n) => n && n.subseriesname);

  const inLangPreferred = rows.find((n) => n.languagecode === lang && n.preferred === "Y");
  if (inLangPreferred) return inLangPreferred.subseriesname;

  const inLang = rows.find((n) => n.languagecode === lang);
  if (inLang) return inLang.subseriesname;

  const preferred = rows.find((n) => n.preferred === "Y");
  if (preferred) return preferred.subseriesname;

  return officialName;
}

export interface LocalizedSubseriesName {
  languagecode: string;
  subseriesname: string;
}

/**
 * The per-language name list shown on the subseries page.
 *
 * One name per language — the preferred row wins over non-preferred ones,
 * like `pickSubseriesName` — sorted by language code so the list is stable
 * whatever order the query returns. The official name is not a language
 * variant, so it is not injected here; the page shows it separately.
 */
export function listSubseriesNames(
  names: SubseriesNameRow[] | null | undefined
): LocalizedSubseriesName[] {
  const byLang = new Map<string, SubseriesNameRow>();

  for (const row of names ?? []) {
    if (!row?.subseriesname || !row.languagecode) continue;
    const current = byLang.get(row.languagecode);
    if (!current || (row.preferred === "Y" && current.preferred !== "Y")) {
      byLang.set(row.languagecode, row);
    }
  }

  return [...byLang.values()]
    .map(({ languagecode, subseriesname }) => ({ languagecode, subseriesname }))
    .sort((a, b) => a.languagecode.localeCompare(b.languagecode));
}

export interface SubseriesListRow {
  subseriescode: string;
  label: string;
  /** Every language variant, newline-joined by the query. */
  allnames?: string | null;
  subseriescategory?: string | null;
  storycount?: number | string | null;
}

/** Accent- and case-insensitive comparison key. */
function foldForSearch(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Whether a catalogue row matches a free-text query.
 *
 * Matches the displayed label, the code, *and* the name in every other
 * language: a visitor browsing in English still finds a subseries by typing
 * its French name.
 */
export function matchesSubseriesQuery(row: SubseriesListRow, query: string): boolean {
  const needle = foldForSearch(query.trim());
  if (!needle) return true;

  const haystack = [row.label, row.subseriescode, ...(row.allnames ?? "").split("\n")];
  return haystack.some((value) => value && foldForSearch(value).includes(needle));
}

export interface SubseriesCategoryGroup {
  category: string;
  items: SubseriesListRow[];
}

/**
 * Groups the catalogue by Inducks category, categories sorted alphabetically
 * with the uncategorised bucket last.
 */
export function groupSubseriesByCategory(rows: SubseriesListRow[]): SubseriesCategoryGroup[] {
  const byCategory = new Map<string, SubseriesListRow[]>();

  for (const row of rows) {
    const category = (row.subseriescategory ?? "").trim();
    const bucket = byCategory.get(category);
    if (bucket) bucket.push(row);
    else byCategory.set(category, [row]);
  }

  return [...byCategory.entries()]
    .sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    })
    .map(([category, items]) => ({ category, items }));
}

export interface SubseriesStorySortable {
  storycode: string;
  firstpublicationdate?: string | null;
}

/**
 * Orders the subseries index like subseries.php: publication date first
 * (unknown dates last), story code as tiebreaker.
 */
export function sortSubseriesStories<T extends SubseriesStorySortable>(stories: T[]): T[] {
  const dateKey = (s: T) => {
    const d = String(s.firstpublicationdate ?? "").trim();
    return d && !d.startsWith("?") ? d : "9999";
  };
  return [...stories].sort((a, b) => {
    const byDate = dateKey(a).localeCompare(dateKey(b));
    if (byDate !== 0) return byDate;
    return a.storycode.localeCompare(b.storycode);
  });
}
