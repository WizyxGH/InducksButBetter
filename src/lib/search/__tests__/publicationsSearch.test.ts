import { describe, it, expect } from 'vitest';
import { buildPublicationsSearchQuery } from '../queryBuilder';

function countPlaceholders(sql: string): number {
  return (sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
}

describe('buildPublicationsSearchQuery', () => {
  describe('publication names must never be joined', () => {
    // `inducks_publicationname` holds every historic/alternative name of a
    // publication (up to four rows), so joining it multiplied both the issue
    // rows and the reported total.
    it('does not join the name table in the count query', () => {
      const result = buildPublicationsSearchQuery({ country: 'fr' });
      expect(result.countQuery).not.toContain('JOIN inducks_publicationname');
    });

    it('does not join the name table in the main query', () => {
      const result = buildPublicationsSearchQuery({ country: 'fr' });
      expect(result.query).not.toContain('JOIN inducks_publicationname');
    });

    it('resolves the series title through a scalar subquery instead', () => {
      const result = buildPublicationsSearchQuery({ country: 'fr' });

      expect(result.query).toContain('as series_title');
      expect(result.query).toContain(
        'SELECT pn.publicationname FROM inducks_publicationname pn WHERE pn.publicationcode = p.publicationcode LIMIT 1'
      );
    });

    it('matches a title against alternative names with EXISTS', () => {
      const result = buildPublicationsSearchQuery({ title: 'Topolino' });

      expect(result.countQuery).toContain('EXISTS (SELECT 1 FROM inducks_publicationname');
      expect(result.countParams).toEqual(['%Topolino%', '%Topolino%', '%Topolino%']);
    });
  });

  describe('parameter binding', () => {
    it('binds exactly as many parameters as the count query has placeholders', () => {
      const result = buildPublicationsSearchQuery({
        country: 'us',
        title: 'comics',
        issuenumber: '1',
        dateAfter: '2000-01-01',
        dateBefore: '2020-01-01',
        publisherid: 'D',
        indexer: 'John',
        collects: true,
        specificTitle: 'Special',
        pages: 100,
        price: '1.99',
        attached: 'poster',
        size: 'A4',
        category: 'magazine',
      });

      expect(result.countParams).toHaveLength(countPlaceholders(result.countQuery));
    });

    it('appends only LIMIT and OFFSET to the main query parameters', () => {
      const result = buildPublicationsSearchQuery({ country: 'fr', rowsperpage: '10', page: 2 });
      expect(result.params).toEqual(['fr', 10, 10]);
    });
  });

  describe('date boundaries', () => {
    it('compares on the year for a year-only bound', () => {
      const result = buildPublicationsSearchQuery({ dateAfter: '1990', dateBefore: '1995' });

      expect(result.countQuery).toContain('SUBSTR(i.oldestdate, 1, 4) >= ?');
      expect(result.countParams).toContain('1990');
      expect(result.countParams).toContain('1995');
    });

    it('widens a month-only bound to cover the whole month', () => {
      const result = buildPublicationsSearchQuery({ dateAfter: '2000-03', dateBefore: '2000-03' });

      expect(result.countParams).toContain('2000-03-00');
      expect(result.countParams).toContain('2000-03-99');
    });
  });

  describe('sorting', () => {
    it('sorts undated issues last when sorting ascending', () => {
      const result = buildPublicationsSearchQuery({ sort: 'date_asc' });
      expect(result.query).toContain("COALESCE(NULLIF(i.oldestdate, ''), '9999-99-99') ASC");
    });

    it('sorts by country code by default', () => {
      const result = buildPublicationsSearchQuery({});
      expect(result.query).toContain('p.countrycode ASC');
    });
  });
});
