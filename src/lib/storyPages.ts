/**
 * Page count of a story version.
 *
 * Inducks stores the length as whole pages plus an optional fraction: a
 * one-panel gag is `entirepages = "0"` with `brokenpage… = 1/4`. Since those
 * columns arrive as *strings*, the obvious `entirepages ? whole : fraction`
 * always took the first branch — `"0"` is truthy in JS — and 156 000 story
 * versions displayed "0 p." instead of their real fraction of a page.
 */

export interface StoryPageSource {
  entirepages?: string | number | null;
  brokenpagenumerator?: string | number | null;
  brokenpagedenominator?: string | number | null;
}

export interface StoryPages {
  /** Printable count, e.g. "12" or "1/4". */
  label: string;
  /** True for a fraction of a page, which reads better as "1/4 page". */
  isFraction: boolean;
}

function toCount(value: string | number | null | undefined): number {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Formats the length, or returns `null` when it is simply unknown — callers
 * then render nothing rather than a meaningless zero.
 */
export function formatStoryPages(version: StoryPageSource | null | undefined): StoryPages | null {
  if (!version) return null;

  const whole = toCount(version.entirepages);
  if (whole > 0) return { label: String(whole), isFraction: false };

  const numerator = toCount(version.brokenpagenumerator);
  const denominator = toCount(version.brokenpagedenominator);
  if (numerator > 0 && denominator > 0) {
    return { label: `${numerator}/${denominator}`, isFraction: true };
  }

  return null;
}
