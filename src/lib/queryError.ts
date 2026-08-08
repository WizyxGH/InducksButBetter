/**
 * Wording for a failed page query.
 *
 * Detail pages used to report every failure as a bare "An error occurred",
 * which hid the one cause users actually hit: no database imported yet. They
 * also raised an anonymous toast per attempt, so a page that fetched twice —
 * StrictMode in development, or a language switch settling — stacked two
 * identical toasts.
 */

/** Shared id so a repeated failure replaces its toast instead of stacking. */
export const QUERY_ERROR_TOAST_ID = "query-error";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function describeQueryError(error: unknown, t: Translate): string {
  const message = (error as Error)?.message ?? String(error ?? "");
  // The worker reports failures as `code` or `code|detail`.
  const code = message.split("|")[0];

  if (code === "error_not_loaded") return t("localDb.error_not_loaded");

  return t("common.error");
}
