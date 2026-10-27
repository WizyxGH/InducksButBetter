/**
 * Collection management utilities for InducksButBetter
 * Handles parsing, storage, and synchronization of Inducks collection data.
 */

export const COLLECTION_STORAGE_KEY = "inducks_collection_issues";
export const COLLECTION_CHANGED_EVENT = "inducks_collection_changed";

/**
 * Parses an Inducks collection export into the issuecodes the search filter
 * matches against.
 *
 * The export ships one record per line as `country^entrycode^type^comment`:
 *
 *     be^MMN   8^digital^
 *     fr^ALJM  37^^Some pages are missing
 *
 * `inducks_entry.issuecode` joins the first two fields with a slash and keeps
 * the interior padding verbatim — `be/MMN   8`, `fr/JM    1`. Collapsing those
 * spaces makes the code match nothing, so only the ends are trimmed.
 *
 * Lines that already carry a full issuecode (anything containing a slash) pass
 * through untouched, which is what makes save → reload → save idempotent: the
 * textarea is rewritten with parsed issuecodes after every save.
 */
export function parseCollection(text: string): string[] {
  const issuecodes = text
    .split(/[\n;]+/)
    .map((line) => {
      const fields = line.split("^");
      const first = fields[0].trim();
      if (!first) return null;

      // Already an issuecode ("fr/JM    1"), possibly with trailing fields.
      if (first.includes("/")) return first;

      // Otherwise it is the country column, and the entrycode follows.
      const entrycode = (fields[1] ?? "").trim();
      if (!entrycode) return null;

      // The export's own header row.
      if (first === "country" && entrycode === "entrycode") return null;

      return `${first}/${entrycode}`;
    })
    .filter((code): code is string => code !== null);

  // A collection commonly lists the same issue twice — once on paper, once as
  // `digital` — and both rows collapse onto one issuecode.
  return [...new Set(issuecodes)];
}

/**
 * Normalizes an issuecode for loose matching by stripping consecutive spaces.
 */
export function normalizeIssuecode(code: string): string {
  return (code || "").trim().replace(/\s+/g, " ");
}

/**
 * Retrieves the currently saved collection from localStorage.
 */
export function getStoredCollection(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load collection from localStorage", err);
    return [];
  }
}

/**
 * Persists the issuecodes array to localStorage and broadcasts an update event.
 */
export function saveStoredCollection(issues: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const unique = [...new Set(issues.filter(Boolean))];
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(unique));
    window.dispatchEvent(new CustomEvent(COLLECTION_CHANGED_EVENT, { detail: unique }));
  } catch (err) {
    console.error("Failed to save collection to localStorage", err);
  }
}

/**
 * Checks whether an issuecode is in the user collection.
 * Supports exact matches and space-normalized comparisons.
 */
export function isIssueInCollection(issuecode: string, collection: string[] | Set<string>): boolean {
  if (!issuecode) return false;
  if (collection instanceof Set) {
    if (collection.has(issuecode)) return true;
    const norm = normalizeIssuecode(issuecode);
    for (const item of collection) {
      if (normalizeIssuecode(item) === norm) return true;
    }
    return false;
  }
  const norm = normalizeIssuecode(issuecode);
  return collection.some((item) => item === issuecode || normalizeIssuecode(item) === norm);
}

/**
 * Adds or removes an issue from the stored collection.
 * @returns true if added, false if removed
 */
export function toggleStoredIssue(issuecode: string): boolean {
  const current = getStoredCollection();
  const norm = normalizeIssuecode(issuecode);
  const existingIdx = current.findIndex(
    (item) => item === issuecode || normalizeIssuecode(item) === norm
  );

  let added = false;
  if (existingIdx >= 0) {
    current.splice(existingIdx, 1);
    added = false;
  } else {
    current.push(issuecode);
    added = true;
  }

  saveStoredCollection(current);
  return added;
}

/**
 * Formats a list of issuecodes as the standard Inducks text export format
 * (country^entrycode^^).
 */
export function formatCollectionExport(issues: string[]): string {
  return issues
    .map((code) => {
      const slash = code.indexOf("/");
      if (slash === -1) return `${code}^^^`;
      const country = code.slice(0, slash);
      const entry = code.slice(slash + 1);
      return `${country}^${entry}^^`;
    })
    .join("\n");
}
