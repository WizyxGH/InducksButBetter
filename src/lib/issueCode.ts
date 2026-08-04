/**
 * Helpers for Inducks issue codes.
 *
 * An issue code is a publication code followed by the issue number, with the
 * number right-aligned in a fixed-width field:
 *
 *     de/LTB   2      publication "de/LTB", issue "2"
 *     de/LTB  10      publication "de/LTB", issue "10"
 *     fr/PM  272      publication "fr/PM",  issue "272"
 *
 * That padding is column alignment, nothing more. It must never reach a URL,
 * where it would show up as `%2F` separators and `+` runs.
 */

export interface IssueCodeParts {
  /** ISO-ish country prefix, e.g. `fr`. */
  countrycode: string;
  /** Full publication code, e.g. `fr/PM`. */
  publicationcode: string;
  /** Issue number as printed, e.g. `272` — may itself contain a space. */
  issuenumber: string;
}

/**
 * Splits an issue code into its country / publication / issue-number parts.
 *
 * The split point is the first run of whitespace after the country prefix,
 * which is where the padding sits. A handful of unpadded codes whose issue
 * number contains a space (`at/KUE1 2`) split one character late; callers that
 * hold the real row should pass `publicationcode` explicitly, and lookups fall
 * back to a whitespace-insensitive match for the rest.
 */
export function splitIssueCode(issuecode: string, publicationcode?: string): IssueCodeParts {
  const code = String(issuecode ?? "").trim();

  if (publicationcode && code.startsWith(publicationcode)) {
    return {
      countrycode: publicationcode.split("/")[0] ?? "",
      publicationcode,
      issuenumber: code.slice(publicationcode.length).trim(),
    };
  }

  const slash = code.indexOf("/");
  const countrycode = slash === -1 ? "" : code.slice(0, slash);
  const rest = slash === -1 ? code : code.slice(slash + 1);

  const gap = rest.search(/\s/);
  if (gap === -1) {
    // No number at all (a bare publication code).
    return { countrycode, publicationcode: code, issuenumber: "" };
  }

  const shortPublication = rest.slice(0, gap);
  return {
    countrycode,
    publicationcode: countrycode ? `${countrycode}/${shortPublication}` : shortPublication,
    issuenumber: rest.slice(gap).trim(),
  };
}

/**
 * Rebuilds a canonical issue code from its parts, using a single space instead
 * of the database's alignment padding. Lookups must therefore compare
 * whitespace-insensitively (or match on the two columns directly).
 */
export function formatIssueCode(publicationcode: string, issuenumber: string): string {
  const pub = String(publicationcode ?? "").trim();
  const num = String(issuenumber ?? "").trim();
  return num ? `${pub} ${num}` : pub;
}

/**
 * Comparison key that ignores the alignment padding, so `fr/PM 272` (from a
 * URL) matches `fr/PM  272` (from the database).
 */
export function issueCodeKey(issuecode: string): string {
  return String(issuecode ?? "").replace(/\s+/g, "");
}
