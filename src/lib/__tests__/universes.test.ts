import { describe, it, expect } from 'vitest';
import { pickUniverseName, listUniverseNames, matchesUniverseQuery } from '../universes';
import { parseRoutePath } from '../routeParser';
import { routes } from '../routes';

/** Real rows: "Ducks" is named in many languages, "Abadazad" in none. */
const DUCKS_NAMES = [
  { languagecode: 'da', universename: 'Andeby' },
  { languagecode: 'en', universename: 'Duckburg' },
  { languagecode: 'fr', universename: 'Donaldville' },
];

describe('pickUniverseName', () => {
  it('prefers the requested language', () => {
    expect(pickUniverseName(DUCKS_NAMES, 'fr', 'Ducks')).toBe('Donaldville');
  });

  it('falls back to English, never to an arbitrary language', () => {
    // Ordering every translation by language code used to surface Danish
    // names ("Andeby") on a site displayed in Italian.
    expect(pickUniverseName(DUCKS_NAMES, 'it', 'Ducks')).toBe('Duckburg');
  });

  it('falls back to the code when nothing is translated', () => {
    expect(pickUniverseName([], 'fr', 'Abadazad')).toBe('Abadazad');
    expect(pickUniverseName(null, 'fr', 'Abadazad')).toBe('Abadazad');
  });

  it('ignores rows with an empty name', () => {
    const names = [{ languagecode: 'fr', universename: '' }, ...DUCKS_NAMES];
    expect(pickUniverseName(names, 'it', 'Ducks')).toBe('Duckburg');
  });
});

describe('listUniverseNames', () => {
  it('returns one name per language, sorted by language code', () => {
    expect(listUniverseNames(DUCKS_NAMES).map((n) => n.languagecode)).toEqual(['da', 'en', 'fr']);
  });

  it('keeps the first name when a language is listed twice', () => {
    const names = [...DUCKS_NAMES, { languagecode: 'fr', universename: 'Duplicate' }];
    expect(listUniverseNames(names).find((n) => n.languagecode === 'fr')!.universename).toBe(
      'Donaldville'
    );
  });

  it('skips rows without a language or a name', () => {
    const names = [{ languagecode: '', universename: 'x' }, { languagecode: 'fr', universename: '' }];
    expect(listUniverseNames(names)).toEqual([]);
  });
});

describe('matchesUniverseQuery', () => {
  const row = {
    universecode: 'Ducks',
    label: 'Duckburg',
    allnames: 'Andeby\nDuckburg\nDonaldville',
  };

  it('matches the displayed label', () => {
    expect(matchesUniverseQuery(row, 'duckb')).toBe(true);
  });

  it('matches the code', () => {
    expect(matchesUniverseQuery(row, 'ducks')).toBe(true);
  });

  it('matches a name in a language that is not displayed', () => {
    // Browsing in English must still find the universe typed in French.
    expect(matchesUniverseQuery(row, 'donaldville')).toBe(true);
  });

  it('ignores accents and case', () => {
    const accented = { universecode: 'X', label: 'Épopée', allnames: '' };
    expect(matchesUniverseQuery(accented, 'epopee')).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesUniverseQuery(row, '   ')).toBe(true);
  });

  it('rejects a query that appears nowhere', () => {
    expect(matchesUniverseQuery(row, 'wizard')).toBe(false);
  });
});

describe('universe routing', () => {
  it('routes the bare path to the catalogue', () => {
    expect(parseRoutePath('universes').tab).toBe('universes');
    expect(parseRoutePath('universes').universecode ?? '').toBe('');
  });

  it('routes a code to the characters tab', () => {
    const parsed = parseRoutePath('universes/Ducks');
    expect(parsed.tab).toBe('characters');
    expect(parsed.universecode).toBe('Ducks');
  });

  it('accepts the singular spelling', () => {
    expect(parseRoutePath('universe/PKNA').universecode).toBe('PKNA');
  });

  it('round-trips a code with spaces and an apostrophe', () => {
    // "A Bug's Life" is a real universe code.
    const code = "A Bug's Life";
    const path = routes.universe(code).replace(/^\//, '');
    const decoded = decodeURIComponent(path.replace(/\+/g, '%20'));
    expect(parseRoutePath(decoded).universecode).toBe(code);
  });
});
