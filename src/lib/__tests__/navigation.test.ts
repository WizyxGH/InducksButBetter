import { describe, it, expect } from 'vitest';
import { isModifiedClick } from '../navigation';
import { routes } from '../routes';
import { parseRoutePath } from '../routeParser';

describe('isModifiedClick', () => {
  // Intercepting these clicks (or emulating them with window.open) is what
  // broke "open in a new tab".
  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)(
    'leaves a %s click to the browser',
    (modifier) => {
      expect(isModifiedClick({ button: 0, [modifier]: true })).toBe(true);
    }
  );

  it('leaves a middle click to the browser', () => {
    expect(isModifiedClick({ button: 1 })).toBe(true);
  });

  it('leaves a right click to the browser', () => {
    expect(isModifiedClick({ button: 2 })).toBe(true);
  });

  it('lets the app handle a plain left click', () => {
    expect(isModifiedClick({ button: 0 })).toBe(false);
  });

  it('lets the app handle a click with no button information', () => {
    expect(isModifiedClick({})).toBe(false);
  });

  it('bails out when a handler already took over', () => {
    expect(isModifiedClick({ button: 0, defaultPrevented: true })).toBe(true);
  });
});

/**
 * `navigate()` and the URL-syncing effect in App must agree on the exact URL
 * for a given entity. When they disagreed, a single click produced two history
 * entries and the back button appeared to skip a step.
 */
describe('routes round-trip through parseRoutePath', () => {
  const decode = (path: string) => decodeURIComponent(path.replace(/\+/g, '%20')).replace(/^\//, '');

  it.each([
    ['W WDC 100-01'],
    ['D 2000-001'],
    ['I TL 2509-1B'],
    ['plain'],
  ])('preserves the storycode %s', (code) => {
    expect(parseRoutePath(decode(routes.story(code))).storycode).toBe(code);
  });

  it.each([['Carl Barks'], ['GAr'], ['Stefano Zanchi']])(
    'preserves the personcode %s',
    (code) => {
      const parsed = parseRoutePath(decode(routes.author(code)));
      expect(parsed.tab).toBe('authors');
      expect(parsed.personcode).toBe(code);
    }
  );

  it.each([['DD'], ['Mickey Mouse']])('preserves the charactercode %s', (code) => {
    const parsed = parseRoutePath(decode(routes.character(code)));
    expect(parsed.tab).toBe('characters');
    expect(parsed.charactercode).toBe(code);
  });

  it.each([['de/LTB 613'], ['nl/HONDPD 1'], ['fr/JM 1234']])(
    'preserves the issuecode %s',
    (code) => {
      const parsed = parseRoutePath(decode(routes.issue(code)));
      expect(parsed.tab).toBe('publications');
      expect(parsed.issuecode).toBe(code);
    }
  );

  it('preserves a publicationcode', () => {
    const parsed = parseRoutePath(decode(routes.publication('de/LTB')));
    expect(parsed.publicationcode).toBe('de/LTB');
  });

  it('preserves a country code', () => {
    const parsed = parseRoutePath(decode(routes.country('fr')));
    expect(parsed.tab).toBe('countries');
    expect(parsed.countrycode).toBe('fr');
  });

  it.each([
    ['settings', routes.settings()],
    ['suggestions', routes.suggestions()],
    ['sql', routes.sql()],
    ['home', routes.home()],
  ])('routes the %s tab', (tab, path) => {
    expect(parseRoutePath(decode(path)).tab).toBe(tab);
  });

  it('encodes spaces the same way for every entity type', () => {
    // A mismatch here (%20 on one side, + on the other) is exactly what
    // produced the duplicate history entries.
    expect(routes.story('a b')).toContain('+');
    expect(routes.author('a b')).toContain('+');
    expect(routes.character('a b')).toContain('+');
    expect(routes.publisher('a b')).toContain('+');
  });
});
