/**
 * Builds the prefilled GitHub issue URL used by the suggestion form.
 *
 * The app is fully serverless, so there is no backend to receive feedback:
 * the honest minimal channel is a prefilled "new issue" page on the project
 * repository, which the user finishes and posts themselves. Kept as a pure
 * module so the URL construction (labels, encoding, truncation) is testable.
 */

export const SUGGESTION_ISSUES_URL = "https://github.com/WizyxGH/InducksButBetter/issues/new";
export const DISCORD_INVITE_URL = "https://discord.gg/trPVaPwDJz";

export type SuggestionType = "idea" | "bug" | "db" | "other";

/** Maps the form's suggestion type to the repository's issue labels. */
const TYPE_LABELS: Record<SuggestionType, string> = {
  idea: "enhancement",
  bug: "bug",
  db: "data",
  other: "question",
};

/** GitHub truncates long titles anyway; keep them scannable in the issue list. */
const MAX_TITLE_LENGTH = 80;

export interface SuggestionInput {
  /** One of `SuggestionType`; anything unknown falls back to `other`. */
  type: string;
  /** Optional display name the user typed in. */
  name?: string;
  message: string;
}

export function buildSuggestionIssueUrl({ type, name, message }: SuggestionInput): string {
  const kind: SuggestionType = (Object.keys(TYPE_LABELS) as SuggestionType[]).includes(
    type as SuggestionType
  )
    ? (type as SuggestionType)
    : "other";

  const trimmed = message.trim();
  // The first line of the message doubles as the issue title, tagged with the
  // suggestion type so triage can happen from the issue list alone.
  const firstLine = trimmed.split("\n")[0].trim();
  const prefix = `[${kind}] `;
  const title = prefix + firstLine.slice(0, MAX_TITLE_LENGTH - prefix.length);

  const bodyParts = [trimmed, "", "---"];
  bodyParts.push(
    name?.trim()
      ? `_Submitted by ${name.trim()} via the in-app suggestion form._`
      : "_Submitted via the in-app suggestion form._"
  );

  // URLSearchParams percent-encodes accents and newlines correctly, which is
  // what broke naive `?title=` concatenation attempts.
  const params = new URLSearchParams({
    title,
    body: bodyParts.join("\n"),
    labels: TYPE_LABELS[kind],
  });

  return `${SUGGESTION_ISSUES_URL}?${params.toString()}`;
}
