/**
 * Builds the `mailto:` link the contact form opens.
 *
 * The app is fully serverless, so there is no backend to receive feedback:
 * the form hands the message to the visitor's own mail client, prefilled.
 * Kept as a pure module so the subject/body encoding stays testable.
 */

export const SUGGESTION_EMAIL = "j.levy228@laposte.net";

/** Mail subjects stay scannable in an inbox list. */
const SUBJECT_PREFIX = "[InducksButBetter] ";
const MAX_SUBJECT_LENGTH = 80;

/**
 * Turns a free-text message into a prefilled mailto link.
 *
 * The first line doubles as the subject so the mail is recognisable in an
 * inbox; the whole message stays in the body, first line included, because the
 * visitor may still edit the subject in their mail client.
 */
export function buildSuggestionMailto(message: string): string {
  const trimmed = (message ?? "").trim();
  const firstLine = trimmed.split("\n")[0].trim();
  const subject = SUBJECT_PREFIX + firstLine.slice(0, MAX_SUBJECT_LENGTH - SUBJECT_PREFIX.length);

  // encodeURIComponent, not URLSearchParams: mailto is not a form payload, so
  // spaces must stay %20 rather than '+', and newlines %0A.
  return (
    `mailto:${SUGGESTION_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(trimmed)}`
  );
}
