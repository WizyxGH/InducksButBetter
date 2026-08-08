import { describe, it, expect } from 'vitest';
import { formatStoryPages } from '../storyPages';

/**
 * Regression guard for the "0 page" bug: the columns arrive as strings, and
 * `"0"` is truthy, so `entirepages ? whole : fraction` always took the whole
 * branch. 156 107 story versions in the dump are 0 whole pages + a fraction.
 */
describe('formatStoryPages', () => {
  it('formats a whole page count', () => {
    expect(formatStoryPages({ entirepages: '12' })).toEqual({ label: '12', isFraction: false });
  });

  it('falls through to the fraction when there are no whole pages', () => {
    // Real row: ae/MM 17f is 0 whole pages, a quarter of a page.
    expect(
      formatStoryPages({ entirepages: '0', brokenpagenumerator: '1', brokenpagedenominator: '4' })
    ).toEqual({ label: '1/4', isFraction: true });
  });

  it('never reports a length of zero', () => {
    const zero = formatStoryPages({
      entirepages: '0',
      brokenpagenumerator: '0',
      brokenpagedenominator: '1',
    });
    expect(zero).toBeNull();
  });

  it('treats an empty or missing length as unknown', () => {
    expect(formatStoryPages({})).toBeNull();
    expect(formatStoryPages({ entirepages: '' })).toBeNull();
    expect(formatStoryPages({ entirepages: null })).toBeNull();
    expect(formatStoryPages(null)).toBeNull();
    expect(formatStoryPages(undefined)).toBeNull();
  });

  it('accepts numbers as well as strings', () => {
    expect(formatStoryPages({ entirepages: 6 })).toEqual({ label: '6', isFraction: false });
    expect(
      formatStoryPages({ entirepages: 0, brokenpagenumerator: 1, brokenpagedenominator: 2 })
    ).toEqual({ label: '1/2', isFraction: true });
  });

  it('ignores surrounding whitespace', () => {
    expect(formatStoryPages({ entirepages: ' 3 ' })).toEqual({ label: '3', isFraction: false });
  });

  it('rejects a fraction missing its denominator', () => {
    expect(formatStoryPages({ entirepages: '0', brokenpagenumerator: '1' })).toBeNull();
    expect(
      formatStoryPages({ entirepages: '0', brokenpagenumerator: '1', brokenpagedenominator: '0' })
    ).toBeNull();
  });

  it('ignores junk values rather than printing NaN', () => {
    expect(formatStoryPages({ entirepages: '?' })).toBeNull();
    expect(formatStoryPages({ entirepages: '-3' })).toBeNull();
  });

  it('prefers whole pages over a fraction when both are present', () => {
    expect(
      formatStoryPages({ entirepages: '2', brokenpagenumerator: '1', brokenpagedenominator: '2' })
    ).toEqual({ label: '2', isFraction: false });
  });
});
