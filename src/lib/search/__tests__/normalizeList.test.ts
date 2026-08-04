import { describe, it, expect } from 'vitest';
import { normalizeList } from '../queryBuilder';

/**
 * `normalizeList` guards the regression that silently voided every advanced
 * search: an empty multi-select serialised to `""`, which the builder read as
 * "match the empty value" instead of "no filter".
 */
describe('normalizeList', () => {
  it('treats nullish input as no filter', () => {
    expect(normalizeList(undefined)).toEqual([]);
    expect(normalizeList(null)).toEqual([]);
  });

  it('treats an empty array as no filter', () => {
    expect(normalizeList([])).toEqual([]);
  });

  it('treats an empty string as no filter, not as an empty value', () => {
    expect(normalizeList('')).toEqual([]);
  });

  it('drops blank entries produced by stray separators', () => {
    expect(normalizeList(',,')).toEqual([]);
    expect(normalizeList('a,,b')).toEqual(['a', 'b']);
    expect(normalizeList(['a', '', '  ', 'b'])).toEqual(['a', 'b']);
  });

  it('splits comma-separated strings', () => {
    expect(normalizeList('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeList(' a , b ')).toEqual(['a', 'b']);
    expect(normalizeList([' a ', 'b '])).toEqual(['a', 'b']);
  });

  it('keeps a single value intact', () => {
    expect(normalizeList('DD')).toEqual(['DD']);
    expect(normalizeList(['DD'])).toEqual(['DD']);
  });
});
