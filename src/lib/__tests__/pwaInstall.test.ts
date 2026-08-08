import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  INSTALL_DISMISSED_KEY,
  REASK_AFTER_MS,
  isDismissalActive,
  isMobileDevice,
  readDismissal,
  rememberDismissal,
  shouldOfferInstall,
} from '../pwaInstall';

const BASE = {
  canInstall: true,
  isInstalled: false,
  isMobile: true,
  dismissed: false,
};

describe('shouldOfferInstall', () => {
  it('offers the install on a fresh mobile visit', () => {
    expect(shouldOfferInstall(BASE)).toBe(true);
  });

  it('stays silent without a captured browser prompt', () => {
    // Nothing to replay: showing a button that does nothing would be worse
    // than showing none.
    expect(shouldOfferInstall({ ...BASE, canInstall: false })).toBe(false);
  });

  it('stays silent on desktop', () => {
    expect(shouldOfferInstall({ ...BASE, isMobile: false })).toBe(false);
  });

  it('stays silent once the app runs standalone', () => {
    expect(shouldOfferInstall({ ...BASE, isInstalled: true })).toBe(false);
  });

  it('respects a recent refusal', () => {
    expect(shouldOfferInstall({ ...BASE, dismissed: true })).toBe(false);
  });
});

describe('isDismissalActive', () => {
  const now = 1_700_000_000_000;

  it('is inactive when nothing was ever stored', () => {
    expect(isDismissalActive(null, now)).toBe(false);
    expect(isDismissalActive(undefined, now)).toBe(false);
    expect(isDismissalActive('', now)).toBe(false);
  });

  it('silences the offer right after a refusal', () => {
    expect(isDismissalActive(String(now - 1000), now)).toBe(true);
  });

  it('lets the offer come back after the re-ask delay', () => {
    expect(isDismissalActive(String(now - REASK_AFTER_MS - 1), now)).toBe(false);
  });

  it('keeps silence exactly at the boundary minus one millisecond', () => {
    expect(isDismissalActive(String(now - REASK_AFTER_MS + 1), now)).toBe(true);
  });

  it('ignores a corrupt value rather than silencing forever', () => {
    expect(isDismissalActive('not-a-number', now)).toBe(false);
    expect(isDismissalActive('0', now)).toBe(false);
    expect(isDismissalActive('-5', now)).toBe(false);
  });

  it('treats a future timestamp as an active refusal', () => {
    // A clock change must not turn into immediate nagging.
    expect(isDismissalActive(String(now + 60_000), now)).toBe(true);
  });
});

describe('dismissal storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through localStorage', () => {
    rememberDismissal(1234);
    expect(readDismissal()).toBe('1234');
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1234');
  });

  it('reads back as an active dismissal', () => {
    const now = Date.now();
    rememberDismissal(now);
    expect(isDismissalActive(readDismissal(), now)).toBe(true);
  });

  it('survives storage being unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => rememberDismissal()).not.toThrow();
    expect(readDismissal()).toBeNull();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('isMobileDevice', () => {
  const withMedia = (coarse: boolean, narrow: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('pointer') ? coarse : narrow,
    }));
  };

  afterEach(() => vi.unstubAllGlobals());

  it('accepts a coarse pointer on a narrow screen', () => {
    withMedia(true, true);
    expect(isMobileDevice()).toBe(true);
  });

  it('rejects a touch laptop with a wide screen', () => {
    withMedia(true, false);
    expect(isMobileDevice()).toBe(false);
  });

  it('rejects a narrow desktop window driven by a mouse', () => {
    withMedia(false, true);
    expect(isMobileDevice()).toBe(false);
  });
});
