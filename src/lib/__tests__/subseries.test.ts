import { describe, it, expect } from 'vitest';
import { pickSubseriesName, sortSubseriesStories } from '../subseries';
import { routes } from '../routes';
import { parseRoutePath } from '../routeParser';

describe('pickSubseriesName', () => {
  const names = [
    { languagecode: 'en', subseriesname: 'Riddles', preferred: 'Y' },
    { languagecode: 'fr', subseriesname: 'Devinettes', preferred: 'Y' },
    { languagecode: 'fr', subseriesname: 'Énigmes', preferred: 'N' },
    { languagecode: 'it', subseriesname: 'Indovinelli', preferred: 'N' },
  ];

  it('prefers the preferred name of the current language', () => {
    expect(pickSubseriesName(names, 'fr', 'Riddles')).toBe('Devinettes');
  });

  it('takes any name of the current language when none is preferred', () => {
    expect(pickSubseriesName(names, 'it', 'Riddles')).toBe('Indovinelli');
  });

  it('falls back to any preferred name for an uncovered language', () => {
    expect(pickSubseriesName(names, 'de', 'Riddles')).toBe('Riddles'); // en preferred comes first
  });

  it('falls back to the official name when there is no localized name at all', () => {
    expect(pickSubseriesName([], 'fr', 'Riddles')).toBe('Riddles');
    expect(pickSubseriesName(null, 'fr', 'Riddles')).toBe('Riddles');
  });

  it('ignores rows with an empty name', () => {
    expect(pickSubseriesName([{ languagecode: 'fr', subseriesname: '', preferred: 'Y' }], 'fr', 'Riddles')).toBe('Riddles');
  });
});

describe('sortSubseriesStories', () => {
  it('orders by publication date then story code, like subseries.php', () => {
    const sorted = sortSubseriesStories([
      { storycode: 'B', firstpublicationdate: '2000-01-01' },
      { storycode: 'A', firstpublicationdate: '2010-05-05' },
      { storycode: 'C', firstpublicationdate: '2000-01-01' },
    ]);
    expect(sorted.map((s) => s.storycode)).toEqual(['B', 'C', 'A']);
  });

  it('puts stories without a usable date last', () => {
    const sorted = sortSubseriesStories([
      { storycode: 'X', firstpublicationdate: '' },
      { storycode: 'Y', firstpublicationdate: '?1950' },
      { storycode: 'Z', firstpublicationdate: '1950' },
    ]);
    expect(sorted.map((s) => s.storycode)).toEqual(['Z', 'X', 'Y']);
  });
});

describe('subseries routing', () => {
  it('URL-encodes the code, spaces included', () => {
    expect(routes.subseries('Zio Paperone e...')).toBe('/subseries/Zio+Paperone+e...');
  });

  it('parses back to the stories tab with the code', () => {
    // App.tsx decodes '+' back to spaces before parseRoutePath runs.
    expect(parseRoutePath('subseries/Zio Paperone e...')).toEqual({
      tab: 'stories',
      subseriescode: 'Zio Paperone e...',
    });
  });

  it('round-trips a code containing accents', () => {
    const code = 'Défis et énigmes';
    const url = routes.subseries(code);
    const decoded = decodeURIComponent(url.replace(/\+/g, '%20')).replace(/^\//, '');
    expect(parseRoutePath(decoded).subseriescode).toBe(code);
  });

  it('routes the bare path to the subseries catalogue, not a detail page', () => {
    expect(parseRoutePath('subseries').tab).toBe('subseries');
    expect(parseRoutePath('subseries').subseriescode ?? '').toBe('');
  });
});
