import { describe, it, expect } from 'vitest';
import { pickReferenceVersion } from '../storyVersion';

const v = (storyversioncode: string, kind: string) => ({ storyversioncode, kind });

describe('pickReferenceVersion', () => {
  it('prefers the originalstoryversioncode over the lexicographic minimum', () => {
    // A 't' (text) rendition can sort before the drawn original and used to
    // put a "Text" badge on a comic.
    const versions = [v('S 88022-T', 't'), v('tS 88022', 'n')];
    expect(pickReferenceVersion(versions, 'tS 88022')?.kind).toBe('n');
  });

  it('falls back to the lowest storyversioncode when the pointer is empty', () => {
    const versions = [v('B', 'n'), v('A', 't')];
    expect(pickReferenceVersion(versions, '')?.storyversioncode).toBe('A');
    expect(pickReferenceVersion(versions, null)?.storyversioncode).toBe('A');
  });

  it('falls back when the pointer dangles (no matching version)', () => {
    const versions = [v('B', 'n'), v('A', 't')];
    expect(pickReferenceVersion(versions, 'Z')?.storyversioncode).toBe('A');
  });

  it('handles a single-version story', () => {
    expect(pickReferenceVersion([v('S 88022', 'n')], 'S 88022')?.kind).toBe('n');
  });

  it('returns undefined for an empty or missing list', () => {
    expect(pickReferenceVersion([], 'X')).toBeUndefined();
    expect(pickReferenceVersion(null, 'X')).toBeUndefined();
  });
});
