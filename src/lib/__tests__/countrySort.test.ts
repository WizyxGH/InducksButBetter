import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sortCountries,
  isMostIssuesSort,
  loadStoredPublicationSort,
  storePublicationSort,
  PUBLICATION_SORT_STORAGE_KEY,
} from '../countrySort';

const c = (countryname: string, maxIssueCount?: number) => ({ countryname, maxIssueCount });

describe('sortCountries', () => {
  it('stays alphabetical by default', () => {
    const sorted = sortCountries([c('Greece', 3000), c('Brazil', 2000), c('Austria', 100)], 'title_asc');
    expect(sorted.map((x) => x.countryname)).toEqual(['Austria', 'Brazil', 'Greece']);
  });

  it('puts the country with the biggest publication first for "most issues"', () => {
    // Brazil's biggest publication has more issues than Greece's, so Brazil
    // must come first even though G < B fails alphabetically.
    const sorted = sortCountries([c('Greece', 1500), c('Brazil', 2600), c('Austria', 100)], 'issues_desc');
    expect(sorted.map((x) => x.countryname)).toEqual(['Brazil', 'Greece', 'Austria']);
  });

  it('breaks ties alphabetically', () => {
    const sorted = sortCountries([c('Greece', 500), c('Brazil', 500)], 'issues_desc');
    expect(sorted.map((x) => x.countryname)).toEqual(['Brazil', 'Greece']);
  });

  it('sends countries without a count to the end of the "most issues" order', () => {
    const sorted = sortCountries([c('Atlantis'), c('Brazil', 10)], 'issues_desc');
    expect(sorted.map((x) => x.countryname)).toEqual(['Brazil', 'Atlantis']);
  });

  it('treats any other sort mode as alphabetical', () => {
    const sorted = sortCountries([c('Greece', 3000), c('Brazil', 1)], 'date_desc');
    expect(sorted.map((x) => x.countryname)).toEqual(['Brazil', 'Greece']);
  });

  it('does not mutate its input', () => {
    const input = [c('Greece', 1), c('Brazil', 2)];
    sortCountries(input, 'issues_desc');
    expect(input.map((x) => x.countryname)).toEqual(['Greece', 'Brazil']);
  });
});

describe('isMostIssuesSort', () => {
  it.each([
    ['issues_desc', true],
    ['issues_asc', false],
    ['title_asc', false],
    [null, false],
    [undefined, false],
  ])('classifies %s as %s', (mode, expected) => {
    expect(isMostIssuesSort(mode as any)).toBe(expected);
  });
});

describe('persisted sort criterion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips through localStorage so both screens share it', () => {
    storePublicationSort('issues_desc');
    expect(loadStoredPublicationSort('title_asc')).toBe('issues_desc');
    expect(localStorage.getItem(PUBLICATION_SORT_STORAGE_KEY)).toBe('issues_desc');
  });

  it('falls back to the given default when nothing is stored', () => {
    expect(loadStoredPublicationSort('title_asc')).toBe('title_asc');
  });

  it('survives a broken localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadStoredPublicationSort('title_asc')).toBe('title_asc');
    spy.mockRestore();
  });
});
