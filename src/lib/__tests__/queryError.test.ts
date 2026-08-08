import { describe, it, expect } from 'vitest';
import { describeQueryError, QUERY_ERROR_TOAST_ID } from '../queryError';

/** Echoes the key so the mapping is visible in assertions. */
const t = (key: string) => key;

describe('describeQueryError', () => {
  it('names the missing database instead of a generic failure', () => {
    // By far the most common cause: the page loaded before any database was
    // imported. "An error occurred" told the user nothing actionable.
    expect(describeQueryError(new Error('error_not_loaded'), t)).toBe('localDb.error_not_loaded');
  });

  it('reads the code from a `code|detail` message', () => {
    expect(describeQueryError(new Error('error_not_loaded|worker gone'), t)).toBe(
      'localDb.error_not_loaded'
    );
  });

  it('falls back to the generic message for a real failure', () => {
    expect(describeQueryError(new Error('SQLITE_ERROR: no such column: x'), t)).toBe('common.error');
  });

  it('survives a thrown value that is not an Error', () => {
    expect(describeQueryError('boom', t)).toBe('common.error');
    expect(describeQueryError(null, t)).toBe('common.error');
    expect(describeQueryError(undefined, t)).toBe('common.error');
  });

  it('exposes a stable toast id so repeats replace instead of stacking', () => {
    // Two toasts appeared whenever a page fetched twice — StrictMode in
    // development, or the language settling after detection.
    expect(QUERY_ERROR_TOAST_ID).toBeTruthy();
    expect(typeof QUERY_ERROR_TOAST_ID).toBe('string');
  });
});
