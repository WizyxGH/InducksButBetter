/**
 * Choice of the story version whose kind/pages/summary the story page shows.
 *
 * A story can have several versions (the drawn original plus a 't' text
 * rendition, say). Picking `MIN(storyversioncode)` used to surface the wrong
 * one — a "Text" badge on a comic — because version codes sort
 * lexicographically, not by importance. `inducks_story.originalstoryversioncode`
 * names the authoritative version, so it wins whenever it is present in the
 * list; the lowest version code stays as the fallback for stories whose
 * original-version pointer is empty or dangling.
 */

export interface VersionLike {
  storyversioncode: string;
}

export function pickReferenceVersion<T extends VersionLike>(
  versions: T[] | null | undefined,
  originalstoryversioncode?: string | null
): T | undefined {
  if (!versions || versions.length === 0) return undefined;

  const original = String(originalstoryversioncode ?? "").trim();
  if (original) {
    const match = versions.find((v) => v.storyversioncode === original);
    if (match) return match;
  }

  return versions.reduce((best, v) =>
    v.storyversioncode < best.storyversioncode ? v : best
  );
}
