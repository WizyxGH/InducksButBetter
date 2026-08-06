import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = join(__dirname, '../../public/locales');
const locales = readdirSync(LOCALES_DIR);
const load = (locale: string) =>
  JSON.parse(readFileSync(join(LOCALES_DIR, locale, 'translation.json'), 'utf8'));

/**
 * Result counts are rendered straight from these keys, so a missing plural
 * form showed "1 auteurs trouvés". i18next picks `_one` / `_other` from the
 * `count` it is given, and falls back to the raw key when neither exists.
 */
const COUNTED = [
  ['authors', 'authors_found'],
  ['characters', 'characters_found'],
  ['search', 'stories_found'],
  ['search', 'publications_found'],
] as const;

describe('pluralised result labels', () => {
  it.each(locales)('%s declares both plural forms', (locale) => {
    const t = load(locale);
    for (const [ns, key] of COUNTED) {
      expect(t[ns]?.[`${key}_one`], `${locale} ${ns}.${key}_one`).toBeTypeOf('string');
      expect(t[ns]?.[`${key}_other`], `${locale} ${ns}.${key}_other`).toBeTypeOf('string');
    }
  });

  it.each(locales)('%s no longer carries the unsuffixed key', (locale) => {
    const t = load(locale);
    for (const [ns, key] of COUNTED) {
      // Leaving it would let i18next resolve the singular to the plural text.
      expect(t[ns]?.[key], `${locale} ${ns}.${key}`).toBeUndefined();
    }
  });

  it.each(locales)('%s interpolates the count in both forms', (locale) => {
    const t = load(locale);
    for (const [ns, key] of COUNTED) {
      expect(t[ns][`${key}_one`]).toContain('{{count');
      expect(t[ns][`${key}_other`]).toContain('{{count');
    }
  });

  it('uses a genuine singular in French', () => {
    const fr = load('fr');
    expect(fr.authors.authors_found_one).toBe('{{count, number}} auteur trouvé');
    expect(fr.search.stories_found_one).toBe('{{count, number}} histoire trouvée');
  });

  it('uses a genuine singular in English', () => {
    const en = load('en');
    expect(en.search.stories_found_one).toBe('{{count, number}} story found');
    expect(en.search.publications_found_one).toBe('{{count, number}} publication found');
  });

  it.each(locales)('%s describes an unknown indexer', (locale) => {
    // The page used to render the raw code as a name above a row of zeroes.
    const t = load(locale);
    expect(t.indexer?.not_found_title).toBeTypeOf('string');
    expect(t.indexer?.not_found_desc).toContain('{{code}}');
  });
});
