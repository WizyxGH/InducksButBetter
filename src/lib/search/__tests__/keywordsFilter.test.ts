import { describe, it, expect } from 'vitest';
import { tokenizeKeywords, stripAccents, keywordLikeVariants } from '../keywords';
import { buildAdvancedSearchQuery } from '../queryBuilder';
import type { SearchFilters } from '../types';

/** Filters as the UI holds them when nothing has been touched. */
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

describe('tokenizeKeywords', () => {
  it('drops stop words and words of 2 characters or less', () => {
    // keywordsummary stores " noël travers les siècles " — the "à" was
    // stripped by Inducks, so it must be stripped from the input too.
    expect(tokenizeKeywords('à travers les siècles')).toEqual(['travers', 'siècles']);
  });

  it('drops English stop words', () => {
    expect(tokenizeKeywords('the treasure of the incas')).toEqual(['treasure', 'incas']);
  });

  it('lowercases and splits on punctuation', () => {
    expect(tokenizeKeywords('Time-Travel, Christmas!')).toEqual(['time', 'travel', 'christmas']);
  });

  it('deduplicates repeated words', () => {
    expect(tokenizeKeywords('noël noël')).toEqual(['noël']);
  });

  it.each([[''], [null], [undefined]])('returns no token for %s', (value) => {
    expect(tokenizeKeywords(value as any)).toEqual([]);
  });
});

describe('stripAccents / keywordLikeVariants', () => {
  it('removes combining accents', () => {
    expect(stripAccents('siècles')).toBe('siecles');
    expect(stripAccents('noël')).toBe('noel');
  });

  it('yields both spellings for an accented word, one for a plain word', () => {
    expect(keywordLikeVariants('siècles')).toEqual(['siècles', 'siecles']);
    expect(keywordLikeVariants('travers')).toEqual(['travers']);
  });
});

/**
 * The fields every keyword variant is tried against, in clause order —
 * title (story + entry), description, curated keywords, mirroring the
 * reference Inducks search which matches its full-text index per word.
 */
const KEYWORD_FIELDS = 5;

describe('keywords filter SQL', () => {
  it('ANDs one multi-field group per meaningful word', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, keywords: 'à travers les siècles' });

    expect(result.countQuery).toContain('sv.keywordsummary LIKE ?');
    expect(result.countQuery).toContain('s_kw.title LIKE ?');
    expect(result.countQuery).toContain('e_kw.title LIKE ?');
    expect(result.countQuery).toContain('sd_kw.desctext LIKE ?');
    expect(result.countQuery).toContain('sv.plotsummary LIKE ?');
    // "travers" (1 variant) + "siècles" (2 variants), each × the field list.
    expect(result.countParams).toEqual([
      ...Array(KEYWORD_FIELDS).fill('%travers%'),
      ...Array(KEYWORD_FIELDS).fill('%siècles%'),
      ...Array(KEYWORD_FIELDS).fill('%siecles%'),
    ]);
    expect(result.countQuery).toContain(' OR ');
  });

  it('widens every word to story comments when the checkbox is on', () => {
    const result = buildAdvancedSearchQuery({
      ...UNTOUCHED,
      keywords: 'travers',
      includeComments: true,
    });

    expect(result.countQuery).toContain('s_kwc.storycomment LIKE ?');
    expect(result.countParams).toEqual(Array(KEYWORD_FIELDS + 1).fill('%travers%'));
  });

  it('leaves comments out of the keyword reach when unchecked', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, keywords: 'travers' });
    expect(result.countQuery).not.toContain('s_kwc.storycomment');
  });

  it('does not touch keywordsummary when the field is empty', () => {
    expect(buildAdvancedSearchQuery(UNTOUCHED).countQuery).not.toContain('keywordsummary');
  });

  it('adds nothing when every word is a stop word', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, keywords: 'le la les' });
    expect(result.countQuery).not.toContain('keywordsummary');
  });

  it('keeps keywords independent from the title filter', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, keywords: 'christmas', title: 'Duck' });
    expect(result.countQuery).toContain('keywordsummary');
    expect(result.countQuery).toContain('s.title LIKE ?');
  });

  it('binds exactly as many parameters as the queries have placeholders', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, keywords: 'à travers les siècles' });
    expect(result.countParams).toHaveLength(countPlaceholders(result.countQuery));
    expect(result.params).toHaveLength(countPlaceholders(result.query));
  });
});

describe('include-comments checkbox', () => {
  it('extends the description search to story comments when checked', () => {
    const result = buildAdvancedSearchQuery({
      ...UNTOUCHED,
      description: 'treasure',
      includeComments: true,
    });

    expect(result.countQuery).toContain('s_cm.storycomment LIKE ?');
    expect(result.countParams).toEqual(['%treasure%', '%treasure%', '%treasure%']);
  });

  it('leaves story comments out when unchecked', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, description: 'treasure' });

    expect(result.countQuery).not.toContain('storycomment');
    expect(result.countParams).toEqual(['%treasure%', '%treasure%']);
  });

  it('reaches the comment through a correlated subquery, never a bare s. alias', () => {
    // `s.storycomment` is out of scope inside the BestVersions CTE (aliases
    // there are `v` and `ids`) and made the main query fail with
    // "no such column: s.storycomment".
    const result = buildAdvancedSearchQuery({
      ...UNTOUCHED,
      description: 'treasure',
      includeComments: true,
    });

    expect(result.query).not.toMatch(/OR s\.storycomment/);
    expect(result.countParams).toHaveLength(countPlaceholders(result.countQuery));
    expect(result.params).toHaveLength(countPlaceholders(result.query));
  });

  it('does nothing at all without a description to search', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, includeComments: true });
    expect(result.countQuery).not.toContain('storycomment');
  });
});

describe('multiple-parts checkbox', () => {
  it('requires an entry with a non-empty part when checked', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, multipleParts: true });

    expect(result.countQuery).toContain("e_p.part IS NOT NULL AND e_p.part != ''");
    expect(result.countParams).toEqual([]);
  });

  it('adds nothing when unchecked', () => {
    expect(buildAdvancedSearchQuery(UNTOUCHED).countQuery).not.toContain('e_p.part');
  });

  it('keeps the clause valid inside the BestVersions CTE (alias rewritten to v)', () => {
    const result = buildAdvancedSearchQuery({ ...UNTOUCHED, multipleParts: true });
    expect(result.query).toContain('e_p.storyversioncode = v.storyversioncode');
  });
});
