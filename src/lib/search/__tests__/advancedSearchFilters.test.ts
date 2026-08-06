import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery } from '../queryBuilder';
import type { SearchFilters } from '../types';

/**
 * Regression suite for `buildAdvancedSearchQuery`.
 *
 * Each block pins down a bug that made the advanced search return wrong (or
 * zero) results, so a future refactor cannot silently reintroduce it.
 */

/** Filters as the UI actually holds them when nothing has been touched. */
const UNTOUCHED: SearchFilters = {
  title: '',
  description: '',
  includeComments: false,
  storycode: '',
  charactercode: [],
  excludeCharactercode: [],
  personRoles: [{ id: 'init', code: '', role: 'any' }],
  excludePersoncode: [],
  publisherid: '',
  kind: [],
  pagesMin: 0,
  pagesExact: '',
  rowsperpage: '24',
  panelsperstrip: '',
  stripsperpage: '',
  language: [],
  country: [],
  herocode: [],
  onlyCollection: false,
  dateAfter: '',
  dateBefore: '',
  nationality: [],
  universes: [],
  subseriescode: [],
  noOtherCharacters: false,
  sort: 'pubdate_asc',
  page: 1,
  indexingIncomplete: false,
  multipleParts: false,
  hasImage: 'all',
};

/** Counts real bind placeholders, ignoring '?' inside SQL string literals. */
function countPlaceholders(sql: string): number {
  return (sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
}

describe('buildAdvancedSearchQuery', () => {
  describe('empty filters', () => {
    it('produces no WHERE clause at all when nothing is filled in', () => {
      const result = buildAdvancedSearchQuery(UNTOUCHED);

      expect(result.countQuery).not.toContain('WHERE');
      expect(result.countParams).toEqual([]);
    });

    it('does not constrain kind when no content type is selected', () => {
      for (const empty of [[], '', undefined, null] as any[]) {
        const result = buildAdvancedSearchQuery({ ...UNTOUCHED, kind: empty });
        expect(result.countQuery).not.toContain('sv.kind');
      }
    });

    it('ignores the placeholder author row the form always renders', () => {
      const result = buildAdvancedSearchQuery(UNTOUCHED);
      expect(result.countQuery).not.toContain('inducks_storyjob');
    });

    it('ignores empty character, country and language selections', () => {
      const result = buildAdvancedSearchQuery(UNTOUCHED);
      expect(result.countQuery).not.toContain('inducks_appearance');
      expect(result.countQuery).not.toContain('p_c.countrycode');
      expect(result.countQuery).not.toContain('p_l.languagecode');
    });
  });

  describe('parameter binding', () => {
    it('binds exactly as many parameters as the count query has placeholders', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        storycode: 'W US 1',
        title: 'Duck',
        description: 'Test',
        includeComments: true,
        kind: ['c', 'n'],
        charactercode: ['MM', 'DD'],
        excludeCharactercode: ['US'],
        personRoles: [{ id: '1', code: 'CB', role: 'w' }],
        excludePersoncode: ['DR'],
        publisherid: 'D',
        pagesExact: 15,
        language: ['en'],
        country: ['us'],
        herocode: ['DD'],
        dateAfter: '2000-01-01',
        dateBefore: '2020-01-01',
        stripsperpage: '4',
        panelsperstrip: '3',
        subseriescode: ['sub'],
        universes: ['u1', 'u2'],
        nationality: ['us', 'fr'],
        hasImage: 'yes',
        multipleParts: true,
        indexingIncomplete: true,
      });

      expect(result.countParams).toHaveLength(countPlaceholders(result.countQuery));
    });

    it('binds exactly as many parameters as the main query has placeholders', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        title: 'Duck',
        kind: ['c'],
        charactercode: ['DD'],
        country: ['us'],
        lang: 'fr',
      });

      expect(result.params).toHaveLength(countPlaceholders(result.query));
    });

    it('places story-level parameters before storyversion-level ones', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, charactercode: ['DD'], kind: ['c'] });
      expect(result.countParams).toEqual(['DD', 'c']);
    });

    it('binds the language once per localised column of the result row', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, lang: 'it' });
      const langCount = result.params.filter((p) => p === 'it').length;

      expect(langCount).toBeGreaterThan(0);
      expect(result.params.slice(-langCount).every((p) => p === 'it')).toBe(true);
    });

    it('defaults the language to French when none is given', () => {
      const result = buildAdvancedSearchQuery(UNTOUCHED);
      expect(result.params).toContain('fr');
    });
  });

  describe('authors', () => {
    it('matches each author at story level so cross-version credits still count', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        personRoles: [
          { id: '1', code: 'GAr', role: 'any' },
          { id: '2', code: 'Stefano Zanchi', role: 'any' },
        ],
      });

      // Two independent story-level clauses, not two constraints on one version.
      const clauses = result.countQuery.match(/SELECT sv_p\.storycode/g) || [];
      expect(clauses).toHaveLength(2);
      expect(result.countQuery).not.toContain('sv.storyversioncode IN (SELECT sj.storyversioncode');
      expect(result.countParams).toEqual(['GAr', 'Stefano Zanchi']);
    });

    it('binds the role instead of interpolating it into the SQL', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        personRoles: [{ id: '1', code: 'CB', role: 'w' }],
      });

      expect(result.countQuery).toContain('sj_p.plotwritartink LIKE ?');
      expect(result.countQuery).not.toContain("LIKE '%w%'");
      expect(result.countParams).toEqual(['CB', '%w%']);
    });

    it('adds no role condition for the "any" role', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        personRoles: [{ id: '1', code: 'CB', role: 'any' }],
      });

      expect(result.countQuery).not.toContain('plotwritartink');
      expect(result.countParams).toEqual(['CB']);
    });

    it('resists a role value crafted to break out of the query', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        personRoles: [{ id: '1', code: 'CB', role: "w' OR '1'='1" }],
      });

      expect(result.countQuery).not.toContain("OR '1'='1");
      expect(result.countParams).toEqual(['CB', "%w' OR '1'='1%"]);
    });

    it('excludes an author across every version of a story', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, excludePersoncode: ['DR'] });

      expect(result.countQuery).toContain('s.storycode NOT IN');
      expect(result.countParams).toEqual(['DR']);
    });
  });

  describe('characters', () => {
    it('requires every selected character, one clause each', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, charactercode: ['DD', 'MM'] });
      const clauses = result.countQuery.match(/app_c\.charactercode COLLATE NOCASE = \?/g) || [];

      expect(clauses).toHaveLength(2);
      expect(result.countParams).toEqual(['DD', 'MM']);
    });

    it('matches heroes on appearance number 0', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, herocode: ['DD'] });
      expect(result.countQuery).toContain('app_h.number = 0');
    });

    it('counts distinct selected characters for the "no other characters" option', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        charactercode: ['DD', 'MM'],
        herocode: ['DD'],
        noOtherCharacters: true,
      });

      // DD appears in both lists but must only be counted once.
      expect(result.countParams).toContain(2);
    });

    it('skips the "no other characters" clause when no character is selected', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, noOtherCharacters: true });
      expect(result.countQuery).not.toContain('COUNT(DISTINCT charactercode)');
    });
  });

  describe('publication country and language', () => {
    it('treats UNPUBLISHED as "no entry exists"', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, country: ['UNPUBLISHED'] });

      expect(result.countQuery).toContain('NOT EXISTS');
      expect(result.countParams).toEqual([]);
    });

    it('combines UNPUBLISHED with real countries using OR', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, country: ['fr', 'UNPUBLISHED'] });

      expect(result.countQuery).toContain(' OR ');
      expect(result.countParams).toEqual(['fr']);
    });

    it('keeps country and language as separate constraints', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, country: ['fr'], language: ['it'] });
      expect(result.countParams).toEqual(['fr', 'it']);
    });
  });

  describe('dates', () => {
    it('binds each bound twice: once for the story date, once for the issue fallback', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        dateAfter: '2000-01-01',
        dateBefore: '2010-01-01',
      });

      expect(result.countParams).toEqual(['2000-01-01', '2010-01-01', '2000-01-01', '2010-01-01']);
    });

    it('supports an open-ended range', () => {
      const after = buildAdvancedSearchQuery({ ...UNTOUCHED, dateAfter: '1990-01-01' });
      expect(after.countParams).toEqual(['1990-01-01', '1990-01-01']);

      const before = buildAdvancedSearchQuery({ ...UNTOUCHED, dateBefore: '1990-01-01' });
      expect(before.countParams).toEqual(['1990-01-01', '1990-01-01']);
    });

    it('falls back to the oldest issue date for stories with no publication date', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, dateAfter: '2000-01-01' });
      expect(result.countQuery).toContain('MIN(i_d.oldestdate)');
    });
  });

  describe('pages', () => {
    it('prefers the exact page count over the range', () => {
      const result = buildAdvancedSearchQuery({
        ...UNTOUCHED,
        pagesExact: '12',
        pagesMin: 1,
        pagesMax: 99,
      });

      // `entirepages` is TEXT, so the comparison must cast — see
      // brokenFilters.test.ts.
      expect(result.countQuery).toContain("CAST(NULLIF(sv.entirepages, '') AS REAL) = ?");
      expect(result.countQuery).not.toContain('AS REAL) >=');
      expect(result.countParams).toEqual([12]);
    });

    it('applies the range when no exact count is given', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, pagesMin: 4, pagesMax: 20 });
      expect(result.countParams).toEqual([4, 20]);
    });

    it('ignores an untouched minimum of zero', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, pagesMin: 0, pagesMax: 20 });
      expect(result.countParams).toEqual([20]);
    });
  });

  describe('pagination and sorting', () => {
    it('derives the LIMIT/OFFSET pair from the page and page size', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, rowsperpage: '10', page: 3 });

      expect(result.pageSize).toBe(10);
      expect(result.page).toBe(3);
      expect(result.params).toContain(20);
    });

    it('falls back to sane pagination for unusable values', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, rowsperpage: 'abc', page: -5 });

      expect(result.pageSize).toBe(24);
      expect(result.page).toBe(1);
    });

    it('joins the story header only when sorting by title', () => {
      expect(buildAdvancedSearchQuery({ ...UNTOUCHED, sort: 'title_az' }).query).toContain('sh_sort');
      expect(buildAdvancedSearchQuery({ ...UNTOUCHED, sort: 'pubdate_asc' }).query).not.toContain('sh_sort');
    });

    it('orders ascending or descending on request', () => {
      expect(buildAdvancedSearchQuery({ ...UNTOUCHED, sort: 'pubdate_asc' }).query).toContain('ASC NULLS LAST');
      expect(buildAdvancedSearchQuery({ ...UNTOUCHED, sort: 'pubdate_desc' }).query).toContain('DESC NULLS LAST');
    });
  });

  describe('image presence', () => {
    it('requires an image when asked for', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, hasImage: 'yes' });
      expect(result.countQuery).toContain('EXISTS');
      expect(result.countQuery).not.toContain('NOT EXISTS');
    });

    it('excludes stories with an image when asked for', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, hasImage: 'no' });
      expect(result.countQuery).toContain('NOT EXISTS');
    });

    it('adds nothing for "all"', () => {
      const result = buildAdvancedSearchQuery({ ...UNTOUCHED, hasImage: 'all' });
      expect(result.countQuery).not.toContain('inducks_entryurl');
    });
  });
});
