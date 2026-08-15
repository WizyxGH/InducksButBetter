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
