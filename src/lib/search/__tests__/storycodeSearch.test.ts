import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery, getStorycodeCandidates } from '../queryBuilder';

/** Extracts the story-code clause and the parameters bound to it. */
function codeClause(storycode: string) {
  const result = buildAdvancedSearchQuery({ storycode });
  return { sql: result.countQuery, params: result.countParams };
}

const rangeClauses = (sql: string) => (sql.match(/s\.storycode COLLATE NOCASE >= \?/g) || []).length;
const likeClauses = (sql: string) =>
  (sql.match(/REPLACE\(s\.storycode, ' '\, ''\) COLLATE NOCASE LIKE \?/g) || []).length;

describe('story code search', () => {
  describe('a full code must not widen to its publication', () => {
    // `I TL 3273-6` used to emit `storycode >= 'I TL' AND < 'I TM'`, which is
    // every Topolino story, OR'd with the precise clause — so a precise search
    // returned thousands of unrelated results.
    it('emits no publication-wide range once an issue number is typed', () => {
      const { sql } = codeClause('I TL 3273-6');
      expect(rangeClauses(sql)).toBe(0);
    });

    it('never binds a truncated prefix that drops the issue number', () => {
      const { params } = codeClause('I TL 3273-6');
      expect(params).not.toContain('I TL');
      expect(params).not.toContain('I TM');
    });

    it('matches on the whole code instead', () => {
      const { params } = codeClause('I TL 3273-6');
      expect(params).toContain('itl3273-6%');
    });

    it.each([
      ['W WDC 100', 'wwdc100%'],
      ['D 2000-001', 'd2000-001%'],
      ['I TL 3000-1', 'itl3000-1%'],
    ])('binds %s as the packed prefix %s', (code, packed) => {
      expect(codeClause(code).params).toContain(packed);
    });
  });

  describe('a bare publication prefix still searches broadly', () => {
    it('keeps the indexed range for a two-word prefix', () => {
      const { sql, params } = codeClause('I TL');
      expect(rangeClauses(sql)).toBeGreaterThan(0);
      expect(params).toContain('I TL');
      expect(params).toContain('I TM');
    });

    it('keeps the range for a single-word prefix', () => {
      const { sql } = codeClause('AR');
      expect(rangeClauses(sql)).toBeGreaterThan(0);
    });
  });

  describe('padding insensitivity', () => {
    it('matches a padded database code from an unpadded query', () => {
      // Story codes are right-aligned in the column ("I TL   18-A"), so the
      // raw column can never be compared to what the user typed.
      const { sql } = codeClause('I TL 18-A');
      expect(likeClauses(sql)).toBeGreaterThan(0);
    });

    it('accepts a code typed without any space', () => {
      expect(codeClause('itl3273-6').params).toContain('itl3273-6%');
    });
  });

  describe('parameter integrity', () => {
    it('binds one parameter per placeholder for every code shape', () => {
      for (const code of ['I TL 3273-6', 'I TL', 'W US 1', 'X', 'D 2000-001', 'H 1984']) {
        const { sql, params } = codeClause(code);
        const placeholders = (sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
        expect(params, `for "${code}"`).toHaveLength(placeholders);
      }
    });
  });

  describe('result ordering', () => {
    it('ranks by code, not by date, when a full code is searched', () => {
      const result = buildAdvancedSearchQuery({ storycode: 'I TL 3000-1', sort: 'pubdate_asc' });
      expect(result.query).toContain('LENGTH(s.storycode) ASC');
    });

    it('applies that ranking whatever sort the form defaults to', () => {
      for (const sort of ['pubdate_asc', 'pubdate_desc', 'title_az']) {
        expect(buildAdvancedSearchQuery({ storycode: 'I TL 3000-1', sort }).query).toContain(
          'LENGTH(s.storycode) ASC'
        );
      }
    });

    it('leaves the chosen sort alone for a bare prefix', () => {
      const result = buildAdvancedSearchQuery({ storycode: 'ITL', sort: 'pubdate_asc' });
      expect(result.query).toContain('ASC NULLS LAST');
    });

    it('leaves the chosen sort alone when no code is searched', () => {
      expect(buildAdvancedSearchQuery({ title: 'duck', sort: 'title_az' }).query).toContain(
        'sh_sort.title ASC'
      );
    });
  });

  describe('Inducks code heuristics still apply', () => {
    it('maps the Dell Giant code W US 1 to its W OS issue', () => {
      const packed = getStorycodeCandidates('W US 1').map((c) => c.packed);
      expect(packed).toContain('wos386');
    });

    it('expands the Topolino shorthand', () => {
      const packed = getStorycodeCandidates('I 3000').map((c) => c.packed);
      expect(packed).toContain('itl3000');
    });

    it('always keeps the code as typed among the candidates', () => {
      const packed = getStorycodeCandidates('I TL 3273-6').map((c) => c.packed);
      expect(packed).toContain('itl3273-6');
    });

    it('emits one packed clause per candidate', () => {
      const code = 'W US 1';
      const { sql } = codeClause(code);
      expect(likeClauses(sql)).toBe(getStorycodeCandidates(code).length);
    });
  });
});
