import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery, buildPublicationsSearchQuery } from '../searchService';

describe('searchService', () => {
  describe('buildAdvancedSearchQuery', () => {
    it('generates a simple title search query with correct parameters', () => {
      const filters = { title: 'Duck' };
      const result = buildAdvancedSearchQuery(filters);
      
      expect(result.query).toContain('s.storyheadercode IN (SELECT sh.storyheadercode FROM inducks_storyheader sh WHERE sh.title LIKE ?)');
      expect(result.countParams).toEqual(['%Duck%', '%Duck%']);
      expect(result.params).toEqual(['%Duck%', '%Duck%', 24, 0, 'fr', 'fr', 'fr', 'fr', 'fr', 'fr', 'fr']);
    });

    it('generates a query for charactercode correctly', () => {
      const filters = { charactercode: 'DD' };
      const result = buildAdvancedSearchQuery(filters);
      
      expect(result.query).toContain('app_c.charactercode COLLATE NOCASE = ?');
      expect(result.countParams).toEqual(['DD']);
    });

    it('generates a query for kind correctly', () => {
      const filters = { kind: 's' };
      const result = buildAdvancedSearchQuery(filters);
      
      expect(result.query).toContain('sv.kind IN (?)');
      expect(result.countParams).toEqual(['s']);
    });

    it('generates a query for kind "n" correctly by including empty strings', () => {
      const filters = { kind: 'n' };
      const result = buildAdvancedSearchQuery(filters);
      
      expect(result.query).toContain("(sv.kind = '' OR sv.kind IS NULL)");
      expect(result.query).toContain("sv.kind IN (?)");
      expect(result.countParams).toEqual(['n']);
    });

    it('generates a query for BOTH charactercode AND kind with CORRECT parameter order', () => {
      const filters = {
        charactercode: 'DD',
        kind: 's'
      };
      const result = buildAdvancedSearchQuery(filters);
      
      // charactercode adds an IN clause to `where`
      const characterClause = 'app_c.charactercode COLLATE NOCASE = ?';
      // kind adds a condition to `svWhere` which wraps in an EXISTS clause at the end of `where`
      const kindClause = 'sv.kind IN (?)';
      
      expect(result.query).toContain(characterClause);
      expect(result.query).toContain(kindClause);

      // In the SQL string, `where` clauses are joined before `svWhere` clauses.
      // So charactercode's '?' comes before kind's '?'.
      // Our bugfix ensures `whereParams` are placed before `svWhereParams`.
      expect(result.countParams).toEqual(['DD', 's']);
    });

    it('generates a query for ALL possible filters without parameter order mismatch', () => {
      const filters = {
        storycode: 'W US 1',
        title: 'Duck',
        description: 'Test',
        includeComments: true,
        kind: 'c,s',
        charactercode: 'MM,DD',
        excludeCharactercode: 'US',
        personRoles: [{ id: '1', code: 'CB', role: 'w' }],
        excludePersoncode: 'DR',
        publisherid: 'D',
        pagesMin: 10,
        pagesMax: 20,
        pagesExact: 15, // exact overrides min/max
        language: 'en',
        country: 'us',
        herocode: 'DD',
        dateAfter: '2000-01-01',
        dateBefore: '2020-01-01',
        stripsperpage: '4',
        panelsperstrip: '3',
        subseriescode: 'sub',
        universes: ['u1', 'u2'],
        nationality: ['us', 'fr'],
        hasImage: 'yes' as const,
        multipleParts: true,
        indexingIncomplete: true
      };

      const result = buildAdvancedSearchQuery(filters);
      
      // Verify that countParams has exactly the number of placeholders used in the whereSql
      // we'll count the number of '?' in the query (excluding the SELECT portion which has fixed placeholders for OFFSET/LIMIT or SELECTs)
      
      // Count ? in countQuery but exclude the literal '?' used in indexingIncomplete
      const queryWithoutLiterals = result.countQuery.replace(/'\?'/g, '');
      const countQuestionMarks = (queryWithoutLiterals.match(/\?/g) || []).length;
      expect(result.countParams.length).toBe(countQuestionMarks);
    });
  });

  describe('buildPublicationsSearchQuery', () => {
    it('generates a simple search query with correct parameters', () => {
      const filters = { country: 'fr' };
      const result = buildPublicationsSearchQuery(filters);
      
      expect(result.query).toContain('p.countrycode = ?');
      expect(result.countParams).toEqual(['fr']);
    });

    it('generates a query for multiple publication filters correctly', () => {
      const filters = {
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
        size: 'A4'
      };

      const result = buildPublicationsSearchQuery(filters);
      
      const countQuestionMarks = (result.countQuery.match(/\?/g) || []).length;
      expect(result.countParams.length).toBe(countQuestionMarks);
    });

    it('uses month and day boundaries for partial publication dates', () => {
      const result = buildPublicationsSearchQuery({ dateAfter: '2000-03', dateBefore: '2000-03' });

      expect(result.params).toContain('2000-03-00');
      expect(result.params).toContain('2000-03-99');
    });
  });
});
