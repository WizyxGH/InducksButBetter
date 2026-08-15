import { describe, it, expect } from 'vitest';
import { thumbUrl, thumbUrls } from '../thumbUrl';

const PROXY = '/api/proxy-image?url=';

function decoded(u: string | null): string {
  expect(u).not.toBeNull();
  return decodeURIComponent(u!.slice(PROXY.length));
}

/**
 * The hr.php URL inducks.org emits for a given image, defined once so the
 * parameter shape is asserted in a single place.
 *
 * Captured from a live cover on the site:
 *   hr.php?image=https%3A%2F%2Foutducks.org%2Fwebusers%2Fwebusers%2F2026%2F06%2Ffr_tp_0075a_001.jpg&normalsize=1
 */
const hr = (image: string, full = false) =>
  `https://inducks.org/hr.php?image=${encodeURIComponent(image)}${full ? '' : '&normalsize=1'}`;

describe('thumbUrl', () => {
  it('returns null when there is no value', () => {
    expect(thumbUrl(null)).toBeNull();
    expect(thumbUrl(undefined)).toBeNull();
    expect(thumbUrl('')).toBeNull();
  });

  it('reproduces the URL inducks.org itself emits', () => {
    expect(decoded(thumbUrl('webusers|2026/06/fr_tp_0075a_001.jpg'))).toBe(
      'https://inducks.org/hr.php?image=' +
        encodeURIComponent('https://outducks.org/webusers/webusers/2026/06/fr_tp_0075a_001.jpg') +
        '&normalsize=1'
    );
  });

  it('doubles the webusers prefix for webusers site codes', () => {
    // inducks_site: webusers -> https://outducks.org/webusers/webusers/
    expect(decoded(thumbUrl('webusers|2020/xx/foo.jpg'))).toBe(
      hr('https://outducks.org/webusers/webusers/2020/xx/foo.jpg')
    );
  });

  it('does not double an already prefixed webusers path', () => {
    expect(decoded(thumbUrl('webusers|webusers/2020/xx/foo.jpg'))).toBe(
      hr('https://outducks.org/webusers/2020/xx/foo.jpg')
    );
  });

  it('keeps absolute URLs untouched', () => {
    expect(decoded(thumbUrl('thumbnails|https://example.org/a.jpg'))).toBe(
      hr('https://example.org/a.jpg')
    );
  });

  it('roots relative paths under the site code, stripping a leading slash', () => {
    // inducks_site: thumbnails -> https://outducks.org/thumbnails/
    expect(decoded(thumbUrl('thumbnails|/thumb/a.jpg'))).toBe(
      hr('https://outducks.org/thumbnails/thumb/a.jpg')
    );
    expect(decoded(thumbUrl('thumbnails|thumb/a.jpg'))).toBe(
      hr('https://outducks.org/thumbnails/thumb/a.jpg')
    );
  });

  it('keeps the site segment for every image site code', () => {
    // Real rows: thumbnails paths themselves begin with "webusers/", and the
    // country site codes hold their own trees. Dropping the segment — as the
    // previous implementation did — pointed all of these at nothing.
    expect(decoded(thumbUrl('thumbnails|webusers/2021/12/ae_dc_0010a_001.jpg'))).toBe(
      hr('https://outducks.org/thumbnails/webusers/2021/12/ae_dc_0010a_001.jpg')
    );
    expect(decoded(thumbUrl('fr|abd/fr_abd_015a_001.jpg'))).toBe(
      hr('https://outducks.org/fr/abd/fr_abd_015a_001.jpg')
    );
    expect(decoded(thumbUrl('us|misc/00/us_90144_a_00_001.jpg'))).toBe(
      hr('https://outducks.org/us/misc/00/us_90144_a_00_001.jpg')
    );
    expect(decoded(thumbUrl('renamed|au/gs/0555/au_gs_555a_001.jpg'))).toBe(
      hr('https://outducks.org/renamed/au/gs/0555/au_gs_555a_001.jpg')
    );
  });

  it('percent-encodes an image path containing an ampersand', () => {
    // Interpolating raw truncated the parameter at the first `&`, silently
    // handing hr.php a shortened path.
    const encoded = decoded(thumbUrl('webusers|2020/a&b/foo.jpg'));
    expect(encoded).toBe(hr('https://outducks.org/webusers/webusers/2020/a&b/foo.jpg'));
    expect(encoded).toContain('a%26b');
  });

  it('accepts a bare url without site code', () => {
    expect(decoded(thumbUrl('thumb/a.jpg'))).toBe(hr('https://outducks.org/thumb/a.jpg'));
  });
});

describe('thumbUrls', () => {
  it('returns null when there is no value', () => {
    expect(thumbUrls(null)).toBeNull();
  });

  it('builds a normalsize preview and a full-size variant on the same base', () => {
    const image = 'https://outducks.org/webusers/webusers/2020/xx/foo.jpg';
    const pair = thumbUrls('webusers|2020/xx/foo.jpg')!;
    expect(decoded(pair.preview)).toBe(hr(image));
    expect(decoded(pair.full)).toBe(hr(image, true));
  });
});
