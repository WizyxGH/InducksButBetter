/**
 * When to offer installing the app.
 *
 * Kept apart from the component so the "should we even ask?" decision — the
 * part that decides whether a user is nagged — is unit-testable without a
 * browser.
 */

export const INSTALL_DISMISSED_KEY = "inducks_install_dismissed_at";

/** A refusal is respected for a month, then the offer may come back once. */
export const REASK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** Whether a stored dismissal still silences the offer. */
export function isDismissalActive(storedValue: string | null | undefined, now: number): boolean {
  if (!storedValue) return false;

  const dismissedAt = Number(storedValue);
  // A corrupt value must not silence the prompt forever.
  if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
  // A timestamp in the future means a clock change; treat it as still active
  // rather than nagging immediately.
  if (dismissedAt > now) return true;

  return now - dismissedAt < REASK_AFTER_MS;
}

export interface InstallOfferState {
  /** The browser captured a `beforeinstallprompt` we can replay. */
  canInstall: boolean;
  /** Already running standalone. */
  isInstalled: boolean;
  /** Only phones and tablets are offered this. */
  isMobile: boolean;
  /** The user said no recently. */
  dismissed: boolean;
}

export function shouldOfferInstall({
  canInstall,
  isInstalled,
  isMobile,
  dismissed,
}: InstallOfferState): boolean {
  return canInstall && isMobile && !isInstalled && !dismissed;
}

/**
 * Coarse pointer *and* a narrow viewport: a touch-screen laptop is not a
 * phone, and neither is a desktop window shrunk to a narrow width.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    window.matchMedia("(max-width: 1024px)").matches
  );
}

export function readDismissal(): string | null {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY);
  } catch {
    // Private mode or blocked storage: just offer the install.
    return null;
  }
}

export function rememberDismissal(now: number = Date.now()): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(now));
  } catch {
    /* nothing to do: the offer will simply come back next visit */
  }
}
