import { describe, it, expect } from 'vitest';
import { splitIssueCode, formatIssueCode, issueCodeKey } from '../issueCode';
import { routes } from '../routes';
import { parseRoutePath } from '../routeParser';

describe('splitIssueCode', () => {
  it.each([
    ['de/LTB   2', 'de', 'de/LTB', '2'],
    ['de/LTB  10', 'de', 'de/LTB', '10'],
    ['fr/PM  272', 'fr', 'fr/PM', '272'],
    ['nl/HONDPD 1', 'nl', 'nl/HONDPD', '1'],
    ['it/TL 2509', 'it', 'it/TL', '2509'],
  ])('splits %s at the alignment padding', (code, country, publication, number) => {
    expect(splitIssueCode(code)).toEqual({
      countrycode: country,
      publicationcode: publication,
      issuenumber: number,
    });
  });

  it('uses the real publication code when one is supplied', () => {
    // `at/KUE1 2` is unpadded and its issue number contains a space, so the
    // heuristic alone would split one character late.
    expect(splitIssueCode('at/KUE1 2', 'at/KUE')).toEqual({
      countrycode: 'at',
      publicationcode: 'at/KUE',
      issuenumber: '1 2',
    });
  });

  it('ignores a publication code that does not prefix the issue code', () => {
    expect(splitIssueCode('fr/PM  272', 'de/LTB').publicationcode).toBe('fr/PM');
  });

  it('handles a bare publication code with no issue number', () => {
    expect(splitIssueCode('de/LTB')).toEqual({
      countrycode: 'de',
      publicationcode: 'de/LTB',
      issuenumber: '',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(splitIssueCode('  fr/PM  272  ').issuenumber).toBe('272');
  });

  it('survives an empty or malformed code', () => {
    expect(splitIssueCode('')).toEqual({ countrycode: '', publicationcode: '', issuenumber: '' });
    expect(splitIssueCode('nocountry 12').issuenumber).toBe('12');
  });
});

describe('formatIssueCode', () => {
  it('joins the parts with a single space, never the padding', () => {
    expect(formatIssueCode('fr/PM', '272')).toBe('fr/PM 272');
  });

  it('omits the separator when there is no issue number', () => {
    expect(formatIssueCode('de/LTB', '')).toBe('de/LTB');
  });
});

describe('issueCodeKey', () => {
  it('makes a padded and an unpadded code compare equal', () => {
    expect(issueCodeKey('fr/PM  272')).toBe(issueCodeKey('fr/PM 272'));
    expect(issueCodeKey('de/LTB   2')).toBe('de/LTB2');
  });
});

describe('routes.issue URL shape', () => {
  it.each([
    ['fr/PM  272', '/countries/fr/PM/272'],
    ['de/LTB   2', '/countries/de/LTB/2'],
    ['de/LTB  10', '/countries/de/LTB/10'],
    ['nl/HONDPD 1', '/countries/nl/HONDPD/1'],
  ])('renders %s as %s', (code, expected) => {
    expect(routes.issue(code)).toBe(expected);
  });

  it('never emits an encoded slash', () => {
    expect(routes.issue('fr/PM  272')).not.toContain('%2F');
  });

  it('never emits a percent-encoded space', () => {
    expect(routes.issue('fr/PM  272')).not.toContain('%20');
  });

  it('collapses alignment padding instead of turning it into plus signs', () => {
    expect(routes.issue('de/LTB   2')).not.toContain('+');
  });

  it('keeps a real space inside an issue number as a plus sign', () => {
    expect(routes.issue('at/KUE1 2', 'at/KUE')).toBe('/countries/at/KUE/1+2');
  });

  it('falls back to the publication URL when there is no issue number', () => {
    expect(routes.issue('de/LTB')).toBe('/countries/de/LTB');
  });

  it('renders a publication as a browsable path too', () => {
    expect(routes.publication('de/LTB')).toBe('/countries/de/LTB');
  });
});

/** Mirrors how App.tsx normalises the pathname before parsing it. */
const urlToParsed = (href: string) =>
  parseRoutePath(decodeURIComponent(href.replace(/^\//, '').replace(/\+/g, '%20')));

describe('issue URL round-trip', () => {
  it.each([
    ['fr/PM  272', 'fr/PM', 'fr/PM 272'],
    ['de/LTB  10', 'de/LTB', 'de/LTB 10'],
    ['nl/HONDPD 1', 'nl/HONDPD', 'nl/HONDPD 1'],
    ['at/KUE1 2', 'at/KUE', 'at/KUE 1 2'],
  ])('parses the URL of %s back to a resolvable code', (code, publicationcode, expected) => {
    const parsed = urlToParsed(routes.issue(code, publicationcode));

    expect(parsed.tab).toBe('publications');
    expect(parsed.issuecode).toBe(expected);
    // The padding is gone, so lookups must compare on the padding-free key.
    expect(issueCodeKey(parsed.issuecode!)).toBe(issueCodeKey(code));
  });

  it('recovers the publication and issue number from the parsed code', () => {
    const parsed = urlToParsed(routes.issue('fr/PM  272', 'fr/PM'));
    expect(splitIssueCode(parsed.issuecode!)).toMatchObject({
      publicationcode: 'fr/PM',
      issuenumber: '272',
    });
  });

  it('parses a hand-typed hierarchical URL', () => {
    // The whole point of the scheme: a user can shorten the URL by hand.
    expect(urlToParsed('/countries/fr/PM/272').issuecode).toBe('fr/PM 272');
    expect(urlToParsed('/countries/fr/PM').publicationcode).toBe('fr/PM');
    expect(urlToParsed('/countries/fr').countrycode).toBe('fr');
  });
});
