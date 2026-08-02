import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery, getStorycodeCandidates } from '../queryBuilder';
import { SearchFilters } from '../types';

describe('queryBuilder', () => {
  describe('getStorycodeCandidates', () => {
    it('should normalize standard prefixes', () => {
      const candidates = getStorycodeCandidates('w us 1');
      expect(candidates.map(c => c.unpacked)).toContain('W US 1');
    });

    it('should map old Dell Giant codes', () => {
      const candidates = getStorycodeCandidates('W US 1');
      expect(candidates.map(c => c.unpacked)).toContain('W OS 386');
    });

    it('should generate packed lowercase codes for searching', () => {
      const candidates = getStorycodeCandidates('I TL 243-A');
      expect(candidates.some(c => c.packed === 'itl243-a')).toBe(true);
    });
  });

  describe('buildAdvancedSearchQuery', () => {
    it('should generate a basic query with pagination', () => {
      const filters: SearchFilters = {};
      const result = buildAdvancedSearchQuery(filters);
      
      expect(result.pageSize).toBe(24);
      expect(result.page).toBe(1);
      expect(result.query).toContain('LIMIT ? OFFSET ?');
    });

    it('should add title filter', () => {
      const filters: SearchFilters = { title: 'Donald' };
      const result = buildAdvancedSearchQuery(filters);
      
      expect(result.query).toContain('e_t.title LIKE ?');
      expect(result.params).toContain('%Donald%');
    });

    it('should add charactercode filter', () => {
      const filters: SearchFilters = { charactercode: 'DD' };
      const result = buildAdvancedSearchQuery(filters);
      
      expect(result.query).toContain('app_c.charactercode COLLATE NOCASE = ?');
      expect(result.params).toContain('DD');
    });
  });
});
