import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const executeQuery = vi.fn();
const buildAdvancedSearchQuery = vi.fn();
const handleDbError = vi.fn();

vi.mock('@/lib/db', () => ({ executeQuery: (...args: any[]) => executeQuery(...args) }));
vi.mock('@/lib/utils', () => ({ handleDbError: (...args: any[]) => handleDbError(...args) }));
vi.mock('@/lib/searchService', () => ({
  buildAdvancedSearchQuery: (...args: any[]) => buildAdvancedSearchQuery(...args),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));

import { useSearchExecution } from '../useSearchExecution';

const FILTERS: any = {
  title: 'duck',
  kind: [],
  country: [],
  charactercode: ['DD'],
  personRoles: [
    { id: 'init', code: '', role: 'any' },
    { id: '2', code: 'CB', role: 'w' },
  ],
  pagesMax: 500,
};

const QUERY = { query: 'MAIN', countQuery: 'COUNT', params: [1], countParams: [2] };

function setup(props: Partial<{ filters: any; pagesSliderMoved: boolean }> = {}) {
  return renderHook(() =>
    useSearchExecution({
      filters: props.filters ?? FILTERS,
      pagesSliderMoved: props.pagesSliderMoved ?? false,
    })
  );
}

describe('useSearchExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildAdvancedSearchQuery.mockReturnValue(QUERY);
    executeQuery.mockImplementation(async ({ sql }: any) =>
      sql === 'COUNT' ? { rows: [{ total: 7 }] } : { rows: [{ storycode: 'X' }] }
    );
  });

  it('starts empty and in its initial state', () => {
    const { result } = setup();

    expect(result.current.results).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.lastSearchFilters).toBeNull();
  });

  it('passes multi-value filters to the builder as arrays', async () => {
    // Flattening them to comma-separated strings turned an empty selection into
    // `""`, which the builder read as "match the empty value" and which made
    // every search return nothing.
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch();
    });

    const passed = buildAdvancedSearchQuery.mock.calls[0][0];
    expect(passed.kind).toEqual([]);
    expect(passed.country).toEqual([]);
    expect(passed.charactercode).toEqual(['DD']);
  });

  it('drops the empty author row the form always renders', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(buildAdvancedSearchQuery.mock.calls[0][0].personRoles).toEqual([
      { id: '2', code: 'CB', role: 'w' },
    ]);
  });

  it('omits the page ceiling until the slider is actually moved', async () => {
    const { result } = setup({ pagesSliderMoved: false });
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(buildAdvancedSearchQuery.mock.calls[0][0].pagesMax).toBeUndefined();
  });

  it('applies the page ceiling once the slider has been moved', async () => {
    const { result } = setup({ pagesSliderMoved: true });
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(buildAdvancedSearchQuery.mock.calls[0][0].pagesMax).toBe(500);
  });

  it('tags the query with the active interface language', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(buildAdvancedSearchQuery.mock.calls[0][0].lang).toBe('fr');
  });

  it('exposes the rows and the total returned by the database', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(result.current.results).toEqual([{ storycode: 'X' }]);
    expect(result.current.totalCount).toBe(7);
  });

  it('runs the count and the page fetch concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    executeQuery.mockImplementation(async ({ sql }: any) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return sql === 'COUNT' ? { rows: [{ total: 1 }] } : { rows: [] };
    });

    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(maxInFlight).toBe(2);
  });

  it('prevents the form submit event from reloading the page', async () => {
    const { result } = setup();
    const preventDefault = vi.fn();

    await act(async () => {
      await result.current.handleSearch({ preventDefault } as any);
    });

    expect(preventDefault).toHaveBeenCalled();
  });

  it('searches with the override filters when one is supplied', async () => {
    const { result } = setup();
    const override = { ...FILTERS, title: 'other', page: 3 };

    await act(async () => {
      await result.current.handleSearch(null, override);
    });

    expect(buildAdvancedSearchQuery.mock.calls[0][0].title).toBe('other');
    expect(result.current.lastSearchFilters).toBe(override);
  });

  it('reports a database failure and clears the results', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));
    const { result } = setup();

    await act(async () => {
      await result.current.handleSearch();
    });

    expect(handleDbError).toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('records the executed SQL so it can be copied', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch();
    });

    expect(result.current.lastExecutedQuery).toEqual({ sql: 'MAIN', args: [1] });
  });

  it('keeps only the newest result when two searches overlap', async () => {
    const resolvers: Array<() => void> = [];
    executeQuery.mockImplementation(
      ({ sql }: any) =>
        new Promise((resolve) => {
          resolvers.push((_v?: unknown) =>
            resolve(sql === 'COUNT' ? { rows: [{ total: resolvers.length }] } : { rows: [{ storycode: sql }] })
          );
        })
    );

    const { result } = setup();

    let first: Promise<void>;
    let second: Promise<void>;
    act(() => {
      first = result.current.handleSearch();
      second = result.current.handleSearch();
    });

    // Resolve the *second* search first, then the stale first one.
    act(() => {
      resolvers[2]();
      resolvers[3]();
    });
    await act(async () => {
      await second!;
    });
    const afterNewest = result.current.results;

    act(() => {
      resolvers[0]();
      resolvers[1]();
    });
    await act(async () => {
      await first!;
    });

    await waitFor(() => expect(result.current.results).toEqual(afterNewest));
  });
});
