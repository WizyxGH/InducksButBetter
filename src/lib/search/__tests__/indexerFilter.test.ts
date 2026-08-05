import { describe, it, expect } from 'vitest';
import { buildPublicationsSearchQuery } from '../queryBuilder';

/**
 * The indexer field used to query a table that does not exist
 * (`inducks_indexer`), so every keystroke raised an SQL error and the
 * autocomplete only ever showed a failure toast. Indexers come from
 * `inducks_issuejob` rows whose job column is 'i'.
 */
describe('indexer filter', () => {
  const build = (indexer: string) => buildPublicationsSearchQuery({ indexer });

  it('reads indexers from the issue-job table', () => {
    expect(build('FGe').countQuery).toContain('inducks_issuejob');
  });

  it('never references the non-existent inducks_indexer table', () => {
    expect(build('FGe').countQuery).not.toContain('inducks_indexer');
  });

  it("restricts to the indexer job column, not translator or letterer", () => {
    expect(build('FGe').countQuery).toContain("ij.inxtransletcol = 'i'");
  });

  it('matches a person code picked from the suggestions', () => {
    const { countQuery, countParams } = build('FGe');
    expect(countQuery).toContain('per.personcode = ?');
    expect(countParams).toContain('FGe');
  });

  it('also matches a freely typed name fragment', () => {
    const { countQuery, countParams } = build('Gerbaldo');
    expect(countQuery).toContain('per.fullname LIKE ?');
    expect(countParams).toContain('%Gerbaldo%');
  });

  it('binds both forms for a single field', () => {
    // One placeholder each for the code and the name comparison.
    expect(build('DGe').countParams.filter((p) => String(p).includes('DGe'))).toHaveLength(2);
  });

  it('trims the typed value', () => {
    expect(build('  FGe  ').countParams).toContain('FGe');
  });

  it('adds no clause when the field is empty', () => {
    expect(buildPublicationsSearchQuery({}).countQuery).not.toContain('inxtransletcol');
  });

  it('binds one parameter per placeholder', () => {
    const { countQuery, countParams } = build('Gerstein');
    const placeholders = (countQuery.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
    expect(countParams).toHaveLength(placeholders);
  });

  it('keeps the filter composable with the other criteria', () => {
    const { countQuery, countParams } = buildPublicationsSearchQuery({
      indexer: 'FGe',
      country: 'fr',
    });
    expect(countQuery).toContain('p.countrycode = ?');
    expect(countParams).toContain('fr');
    expect(countParams).toContain('FGe');
  });
});
