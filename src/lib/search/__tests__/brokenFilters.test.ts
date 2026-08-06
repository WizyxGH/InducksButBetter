import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery } from '../queryBuilder';

/**
 * Two filters were silently useless until an audit ran every one of them
 * against the real database.
 */
describe('publisher filter', () => {
  const build = () => buildAdvancedSearchQuery({ publisherid: 'Ehapa Verlag' });

  it('joins publishing jobs through the issue, which is what they key on', () => {
    // inducks_publishingjob has only (publisherid, issuecode,
    // publishingjobcomment); the clause referenced pjob.storyversioncode, so
    // every search with a publisher failed with "no such column".
    expect(build().countQuery).not.toContain('pjob.storyversioncode');
    expect(build().countQuery).toContain('e_pub.issuecode = pjob.issuecode');
  });

  it('still ties the result back to the story version', () => {
    expect(build().countQuery).toContain('e_pub.storyversioncode = sv.storyversioncode');
  });

  it('binds the publisher id', () => {
    expect(build().countParams).toContain('Ehapa Verlag');
  });

  it('adds nothing when no publisher is given', () => {
    expect(buildAdvancedSearchQuery({}).countQuery).not.toContain('publishingjob');
  });
});

describe('page-count filter', () => {
  // `entirepages` is a TEXT column. Comparing it to a number made SQLite apply
  // text affinity to the number, so `entirepages >= 5` became `'10' >= '5'` —
  // false. A 5-to-12 range matched 0 stories instead of 38747.
  const CAST = "CAST(NULLIF(sv.entirepages, '') AS REAL)";

  it('compares a minimum numerically', () => {
    const { countQuery, countParams } = buildAdvancedSearchQuery({ pagesMin: 5 });
    expect(countQuery).toContain(`${CAST} >= ?`);
    expect(countParams).toContain(5);
  });

  it('compares a maximum numerically', () => {
    expect(buildAdvancedSearchQuery({ pagesMax: 12 }).countQuery).toContain(`${CAST} <= ?`);
  });

  it('compares an exact count numerically', () => {
    expect(buildAdvancedSearchQuery({ pagesExact: '10' }).countQuery).toContain(`${CAST} = ?`);
  });

  it('never compares the raw text column to a number', () => {
    const { countQuery } = buildAdvancedSearchQuery({ pagesMin: 5, pagesMax: 12 });
    expect(countQuery).not.toMatch(/sv\.entirepages\s*[<>=]/);
  });

  it('lets an exact count win over a range, as the form intends', () => {
    const { countQuery } = buildAdvancedSearchQuery({ pagesExact: '10', pagesMin: 5, pagesMax: 12 });
    expect(countQuery).toContain(`${CAST} = ?`);
    expect(countQuery).not.toContain(`${CAST} >= ?`);
  });

  it('accepts a fractional page count', () => {
    expect(buildAdvancedSearchQuery({ pagesExact: '1.5' }).countParams).toContain(1.5);
  });

  it('adds no clause when the range is unset', () => {
    expect(buildAdvancedSearchQuery({}).countQuery).not.toContain('entirepages');
  });

  it('binds one parameter per placeholder', () => {
    const { countQuery, countParams } = buildAdvancedSearchQuery({
      pagesMin: 5,
      pagesMax: 12,
      publisherid: 'Abril',
    });
    const placeholders = (countQuery.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
    expect(countParams).toHaveLength(placeholders);
  });
});
