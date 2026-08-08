/**
 * Pure helpers for character universes.
 *
 * A universe carries no name of its own on `inducks_universe` — only a code
 * ("Ducks", "PKNA") and an optional comment. Its readable names live in
 * `inducks_universename`, one per language. The reference site (universe.php)
 * shows the name of the visitor's language and falls back to the code, which
 * is what these helpers reproduce.
 */

export interface UniverseNameRow {
  languagecode: string;
  universename: string;
}

/**
 * Picks the display name: the requested language, then English, then the code
 * itself. Deliberately never falls back to an arbitrary third language — that
 * surfaced Danish names on the French site.
 */
export function pickUniverseName(
  names: UniverseNameRow[] | null | undefined,
  lang: string,
  universecode: string
): string {
  const rows = (names ?? []).filter((n) => n && n.universename);

  return (
    rows.find((n) => n.languagecode === lang)?.universename ||
    rows.find((n) => n.languagecode === "en")?.universename ||
    universecode
  );
}

export interface LocalizedUniverseName {
  languagecode: string;
  universename: string;
}

/** One name per language, sorted by language code, for the detail page. */
export function listUniverseNames(
  names: UniverseNameRow[] | null | undefined
): LocalizedUniverseName[] {
  const byLang = new Map<string, string>();

  for (const row of names ?? []) {
    if (!row?.universename || !row.languagecode) continue;
    if (!byLang.has(row.languagecode)) byLang.set(row.languagecode, row.universename);
  }

  return [...byLang.entries()]
    .map(([languagecode, universename]) => ({ languagecode, universename }))
    .sort((a, b) => a.languagecode.localeCompare(b.languagecode));
}

export interface UniverseListRow {
  universecode: string;
  label: string;
  /** Every language variant, newline-joined by the query. */
  allnames?: string | null;
  charactercount?: number | string | null;
}

/** Accent- and case-insensitive comparison key. */
function foldForSearch(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Whether a catalogue row matches a free-text query — against the displayed
 * label, the code, and the name in every other language, so a universe is
 * findable whatever language the site is displayed in.
 */
export function matchesUniverseQuery(row: UniverseListRow, query: string): boolean {
  const needle = foldForSearch(query.trim());
  if (!needle) return true;

  const haystack = [row.label, row.universecode, ...(row.allnames ?? "").split("\n")];
  return haystack.some((value) => value && foldForSearch(value).includes(needle));
}
