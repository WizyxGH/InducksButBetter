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
