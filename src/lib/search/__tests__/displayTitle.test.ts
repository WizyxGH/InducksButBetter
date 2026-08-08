import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery } from '../queryBuilder';
import type { SearchFilters } from '../types';

/**
 * Regression guard for the "Arabic titles on a French site" bug.
 *
 * `story_title` is the display fallback used when the UI language has no
 * edition. It used to order *every* language by entry code and take the first,
 * which handed the title to whichever edition sorted first alphabetically —
 * "ae/DDF…" (Arabic) beat everything else.
 */
const UNTOUCHED: SearchFilters = {
  title: '',
  keywords: '',
  description: '',
  includeComments: false,
  storycode: '',
  charactercode: [],
  excludeCharactercode: [],
  personRoles: [],
  excludePersoncode: [],
  publisherid: '',
  kind: [],
  pagesMin: 0,
  pagesExact: '',
  rowsperpage: '24',
  language: [],
  country: [],
  herocode: [],
  onlyCollection: false,
  dateAfter: '',
  dateBefore: '',
  nationality: [],
  universes: [],
  subseriescode: [],
  sort: 'pubdate_asc',
  page: 1,
  multipleParts: false,
  hasImage: 'all',
};

/** Counts real bind placeholders, ignoring '?' inside SQL string literals. */
function countPlaceholders(sql: string): number {
  return (sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
}

/** Isolates the story_title expression from the generated SELECT. */
function storyTitleClause(sql: string): string {
  const end = sql.indexOf(') as story_title');
  expect(end).toBeGreaterThan(-1);
  return sql.slice(sql.lastIndexOf('COALESCE(', end), end);
}

describe('story_title display fallback', () => {
  const { query } = buildAdvancedSearchQuery({ ...UNTOUCHED, lang: 'fr' });

  it('restricts the localised lookup to the UI language and English', () => {
    expect(storyTitleClause(query)).toContain("pub.languagecode IN (?, 'en')");
  });

  it('prefers the UI language over English', () => {
    expect(storyTitleClause(query)).toContain('CASE WHEN pub.languagecode = ? THEN 0 ELSE 1 END');
  });

  it('falls back to the title stored on the story before any other language', () => {
    const clause = storyTitleClause(query);
    const storyTitle = clause.indexOf("NULLIF(NULLIF(s.title, 'Untitled'), '')");
    const anyLanguage = clause.indexOf('ORDER BY e.entrycode ASC LIMIT 1)', storyTitle);
    expect(storyTitle).toBeGreaterThan(-1);
    // The unrestricted lookup exists, but only after the story own title.
    expect(anyLanguage).toBeGreaterThan(storyTitle);
  });

  it('never orders every language by entry code as its first choice', () => {
    // The exact shape of the old bug: no language filter, ordered by entrycode.
    const clause = storyTitleClause(query);
    const firstBranch = clause.slice(0, clause.indexOf("NULLIF(NULLIF(s.title"));
    expect(firstBranch).toContain('pub.languagecode IN');
  });

  it('binds one parameter per placeholder', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, lang: 'fr' });
    expect(result.params).toHaveLength(countPlaceholders(result.query));
    expect(result.countParams).toHaveLength(countPlaceholders(result.countQuery));
  });

  it('passes the requested language, not a hardcoded default', () => {
    const { params } = buildAdvancedSearchQuery({ ...UNTOUCHED, lang: 'it' });
    expect(params.filter((p) => p === 'it').length).toBeGreaterThanOrEqual(2);
    expect(params).not.toContain('fr');
  });
});
