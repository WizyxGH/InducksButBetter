import { describe, it, expect } from 'vitest';
import { thumbUrl, thumbUrls } from '../thumbUrl';

const PROXY = '/api/proxy-image?url=';

function decoded(u: string | null): string {
  expect(u).not.toBeNull();
  return decodeURIComponent(u!.slice(PROXY.length));
}

describe('thumbUrl', () => {
  it('returns null when there is no value', () => {
    expect(thumbUrl(null)).toBeNull();
    expect(thumbUrl(undefined)).toBeNull();
    expect(thumbUrl('')).toBeNull();
  });

  it('doubles the webusers prefix for webusers site codes', () => {
    // Outducks stores recent uploads under webusers/webusers/.
    expect(decoded(thumbUrl('webusers|2020/xx/foo.jpg'))).toBe(
      'https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/webusers/webusers/2020/xx/foo.jpg'
    );
  });

  it('does not double an already prefixed webusers path', () => {
    expect(decoded(thumbUrl('webusers|webusers/2020/xx/foo.jpg'))).toBe(
      'https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/webusers/2020/xx/foo.jpg'
    );
  });

  it('keeps absolute URLs untouched', () => {
    expect(decoded(thumbUrl('thumbnails|https://example.org/a.jpg'))).toBe(
      'https://inducks.org/hr.php?normalsize=1&image=https://example.org/a.jpg'
    );
  });

  it('roots relative paths on outducks.org, stripping a leading slash', () => {
    expect(decoded(thumbUrl('thumbnails|/thumb/a.jpg'))).toBe(
      'https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/thumb/a.jpg'
    );
    expect(decoded(thumbUrl('thumbnails|thumb/a.jpg'))).toBe(
      'https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/thumb/a.jpg'
    );
  });

  it('accepts a bare url without site code', () => {
    expect(decoded(thumbUrl('thumb/a.jpg'))).toBe(
      'https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/thumb/a.jpg'
    );
  });
});

describe('thumbUrls', () => {
  it('returns null when there is no value', () => {
    expect(thumbUrls(null)).toBeNull();
  });

  it('builds a normalsize preview and a full-size variant on the same base', () => {
    const pair = thumbUrls('webusers|2020/xx/foo.jpg')!;
    expect(decoded(pair.preview)).toBe(
      'https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/webusers/webusers/2020/xx/foo.jpg'
    );
    expect(decoded(pair.full)).toBe(
      'https://inducks.org/hr.php?image=https://outducks.org/webusers/webusers/2020/xx/foo.jpg'
    );
  });
});
