/**
 * Annotations carried by an issue entry (a printing of a story).
 *
 * Inducks records how a given printing differs from the original story —
 * pages cut, panels missing, artwork mirrored, an editorial comment. None of
 * it was surfaced here. This mirrors the presentation of the reference site
 * (`programs/coa/util40-entrytable.php`): a few labelled fields, plus a list
 * of short notes.
 */

export interface EntryRow {
  entrycomment?: string | null;
  changes?: string | null;
  minorchanges?: string | null;
  cut?: string | null;
  missingpanels?: string | null;
  mirrored?: string | null;
  sideways?: string | null;
  printedcode?: string | null;
  includedinentrycode?: string | null;
}

/** A note needing translation, with the parameters its message expects. */
export interface EntryNote {
  key: string;
  params?: Record<string, string | number>;
}

export interface EntryAnnotations {
  /** Free-text editorial comment. */
  comment: string;
  /** Description of how this printing was altered. */
  changes: string;
  /** Smaller alterations. */
  minorChanges: string;
  /** The code printed in the magazine, when it differs from the Inducks one. */
  printedCode: string;
  /** Short flags rendered as a bullet list. */
  notes: EntryNote[];
}

const text = (value: unknown): string => (value == null ? "" : String(value).trim());

/**
 * Formats the `cut` field, e.g. `"4"` or `"4 (last page)"`.
 *
 * Inducks phrases it against the original page count, so `originalPages` is
 * needed to choose singular or plural; without it a shorter message is used
 * rather than inventing a total.
 */
function cutNote(raw: string, originalPages?: number | null): EntryNote | null {
  const match = raw.match(/^\s*([\d.,/]+)\s*(?:\((.*)\))?\s*$/);
  if (!match) return null;

  const cutPages = Number(match[1].replace(",", "."));
  if (!Number.isFinite(cutPages) || cutPages <= 0) return null;

  const comment = text(match[2]);
  const total = Number(originalPages);

  if (Number.isFinite(total) && total > 0) {
    return {
      key: comment ? "entry.cut_of_total_comment" : "entry.cut_of_total",
      params: { count: cutPages, total, comment },
    };
  }
  return { key: comment ? "entry.cut_comment" : "entry.cut", params: { count: cutPages, comment } };
}

/** Formats the `missingpanels` field: `'r'` means a whole row of panels. */
function missingPanelsNote(raw: string): EntryNote {
  if (raw === "r") return { key: "entry.missing_row" };
  const count = Number(raw);
  return Number.isFinite(count) && count > 0
    ? { key: "entry.missing_panels", params: { count } }
    : { key: "entry.missing_panels_other", params: { value: raw } };
}

/**
 * Turns a raw entry row into the pieces the UI renders.
 *
 * `originalPages` is the page count of the story this entry reprints; it is
 * only used to phrase the "pages cut" note.
 */
export function getEntryAnnotations(
  entry: EntryRow | null | undefined,
  originalPages?: number | null
): EntryAnnotations {
  const notes: EntryNote[] = [];
  const row = entry ?? {};

  const changes = text(row.changes);
  // Inducks writes a lone dash to mean "reprinted as-is".
  const isUnaltered = changes === "-";
  if (isUnaltered) notes.push({ key: "entry.unaltered_reprint" });

  const cut = text(row.cut);
  if (cut) {
    const note = cutNote(cut, originalPages);
    if (note) notes.push(note);
  }

  const missingPanels = text(row.missingpanels);
  if (missingPanels) notes.push(missingPanelsNote(missingPanels));

  if (text(row.mirrored) === "Y") notes.push({ key: "entry.mirrored" });
  if (text(row.sideways) === "Y") notes.push({ key: "entry.sideways" });
  if (text(row.includedinentrycode)) notes.push({ key: "entry.included_above" });

  return {
    comment: text(row.entrycomment),
    changes: isUnaltered ? "" : changes,
    minorChanges: text(row.minorchanges),
    printedCode: text(row.printedcode),
    notes,
  };
}

/** True when an entry carries nothing worth rendering. */
export function hasEntryAnnotations(a: EntryAnnotations): boolean {
  return Boolean(a.comment || a.changes || a.minorChanges || a.printedCode || a.notes.length);
}
