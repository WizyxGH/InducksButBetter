/**
 * Grouping rules for the list of issues shown on a publication page.
 *
 * Inducks splits a publication into *issue ranges* — the `h2` headers of the
 * `.dbi` source files, stored in `inducks_issuerange`. `fr/SPGHS` is the
 * canonical example: a handful of unheadered issues, then one section per
 * spin-off series ("L'histoire de la dynastie Picsou", …). Publications
 * without any range (the majority) keep the year grouping this page has
 * always used.
 *
 * The reference implementation is `publication.php` in the Inducks sources;
 * the behaviours mirrored here are called out per function.
 */

export interface IssueRange {
  issuerangecode: string;
  title?: string | null;
  issuerangecomment?: string | null;
  circulation?: string | null;
}

export interface PublicationIssue {
  issuecode: string;
  issuenumber?: string | null;
  issuerangecode?: string | null;
  oldestdate?: string | null;
  [key: string]: unknown;
}

export interface IssueSection<T> {
  /** Stable React key. Empty string for the leading unheadered section. */
  key: string;
  /** Header text, or `null` when the section must render without a header. */
  title: string | null;
  /** True when `title` is a fallback code rather than a real name. */
  titleIsCode?: boolean;
  comment?: string;
  circulation?: string;
  issues: T[];
}

/**
 * The issue number as Inducks displays it inside a range.
 *
 * The ISV files keep the range prefix inside `issuenumber`
 * (`nl/AD195011` + `19501101` → the page shows `01`), so the printable number
 * is the issue code minus its range code. Ranges whose code is not a prefix of
 * the issue code — `it/TL    0` grouping `it/TL    1` — keep `issuenumber`.
 */
export function issueDisplayNumber(
  issuecode: string,
  issuerangecode?: string | null,
  issuenumber?: string | null
): string {
  const fallback = (issuenumber ?? "").trim() || issuecode;
  if (!issuerangecode || !issuecode.startsWith(issuerangecode)) return fallback;

  const stripped = issuecode.slice(issuerangecode.length).replace(/^[\s-]+/, "").trim();
  return stripped || fallback;
}

/**
 * Splits issues into range sections.
 *
 * Mirrors `publication.php`: issues are walked in issue-code order and a new
 * section opens only when a *non-empty* range code differs from the current
 * one. An issue with no range code therefore stays in the section it follows,
 * and the leading unranged issues form a headerless first section. Ranges
 * declared in `inducks_issuerange` but holding no issue are skipped, exactly
 * as an empty `h2` is on the reference site.
 */
export function groupIssuesByRange<T extends PublicationIssue>(
  issues: T[],
  ranges: IssueRange[]
): IssueSection<T>[] {
  const byCode = new Map<string, IssueRange>(ranges.map((r) => [r.issuerangecode, r] as const));
  const sections: IssueSection<T>[] = [];
  let current: IssueSection<T> | null = null;

  for (const issue of issues) {
    const code = issue.issuerangecode || "";

    if (!current || (code && code !== current.key)) {
      const range: IssueRange | undefined = code ? byCode.get(code) : undefined;
      const rangeTitle: string = (range?.title ?? "").trim();
      current = {
        key: code,
        title: code ? rangeTitle || code : null,
        titleIsCode: code ? !rangeTitle : false,
        comment: (range?.issuerangecomment ?? "").trim() || undefined,
        circulation: (range?.circulation ?? "").trim() || undefined,
        issues: [],
      };
      sections.push(current);
    }

    current.issues.push(issue);
  }

  return sections;
}

/**
 * Splits issues into year sections, newest label last.
 *
 * Used for the publications Inducks does not divide into ranges.
 */
export function groupIssuesByYear<T extends PublicationIssue>(
  issues: T[],
  unknownLabel: string
): IssueSection<T>[] {
  const byYear = new Map<string, T[]>();

  for (const issue of issues) {
    const date = issue.oldestdate ?? "";
    const known =
      date && date !== "0000-00-00" && date !== "9999-99-99" && date.length >= 4;
    const year = known ? date.substring(0, 4) : unknownLabel;

    const bucket = byYear.get(year);
    if (bucket) bucket.push(issue);
    else byYear.set(year, [issue]);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => {
      // Issues whose date is unknown belong at the end, not under "0000".
      if (a === unknownLabel) return 1;
      if (b === unknownLabel) return -1;
      return a.localeCompare(b);
    })
    .map(([year, list]) => ({ key: year, title: year, issues: list }));
}

/**
 * Picks the grouping a publication should use: by range when Inducks declares
 * at least one non-empty range for it, by year otherwise.
 */
export function buildIssueSections<T extends PublicationIssue>(
  issues: T[],
  ranges: IssueRange[],
  unknownLabel: string
): IssueSection<T>[] {
  const usable = ranges.filter((r) => !!r.issuerangecode);
  const hasRangedIssue = issues.some((i) => !!i.issuerangecode);

  return usable.length > 0 && hasRangedIssue
    ? groupIssuesByRange(issues, ranges)
    : groupIssuesByYear(issues, unknownLabel);
}
