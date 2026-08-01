import { describe, it, expect } from 'vitest';
import { escapeCsv } from '../export';

describe('export search results', () => {
  describe('escapeCsv', () => {
    it('should leave normal strings unchanged', () => {
      expect(escapeCsv('Donald Duck')).toBe('Donald Duck');
    });

    it('should escape strings containing commas', () => {
      expect(escapeCsv('Duck, Donald')).toBe('"Duck, Donald"');
    });

    it('should escape strings containing double quotes', () => {
      expect(escapeCsv('The "Duck"')).toBe('"The ""Duck"""');
    });

    it('should escape strings containing newlines', () => {
      expect(escapeCsv('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });

    it('should prepend a single quote to prevent Excel formula injection', () => {
      expect(escapeCsv('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
      expect(escapeCsv('-123')).toBe("'-123");
      expect(escapeCsv('+123')).toBe("'+123");
      expect(escapeCsv('@123')).toBe("'@123");
    });
    
    it('should handle undefined or null', () => {
      expect(escapeCsv(undefined)).toBe('');
      expect(escapeCsv(null)).toBe('');
    });
  });
});
