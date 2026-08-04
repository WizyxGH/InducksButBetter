import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery } from '../queryBuilder';

/**
 * SQLite's `GROUP_CONCAT(DISTINCT x)` silently ignores the separator argument
 * and always joins with a comma. The result row is parsed on the client with
 * `;`, so using DISTINCT collapsed every credit of a story into one entry:
 * "Roberto Moscato,w" as the only writer, and no artist at all.
 *
 * Commas are also unusable as a separator here: 120 publication titles contain
 * one.
 */
describe('aggregated list columns', () => {
  const { query } = buildAdvancedSearchQuery({ title: 'x' });

  it('separates credits with a semicolon', () => {
    expect(query).toContain(
      "GROUP_CONCAT(sj.plotwritartink || ':' || p.personcode || '|' || p.fullname, ';')"
    );
  });

  it('separates the publication list with a semicolon', () => {
    expect(query).toContain(
      "GROUP_CONCAT(p_c.countrycode || '|' || p_c.title || '|' || i_c.issuenumber, ';')"
    );
  });

  it('never combines DISTINCT with an explicit separator', () => {
    const offenders = query.match(/GROUP_CONCAT\(\s*DISTINCT[^)]*,\s*'[^']*'\s*\)/g) || [];
    expect(offenders).toEqual([]);
  });

  it('keeps the semicolon separator on the character list', () => {
    expect(query).toContain("), ';')");
  });
});
