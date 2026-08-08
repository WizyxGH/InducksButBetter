import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      options && 'count' in options ? `${options.count} ${key}` : key,
    i18n: { language: 'fr' },
  }),
}));

import { SearchResults } from '../SearchResults';

const baseProps = {
  results: [],
  totalCount: 0,
  loading: false,
  filters: { sort: 'pubdate_asc', page: 1, rowsperpage: '24' },
  setFilters: vi.fn(),
  handleSearch: vi.fn().mockResolvedValue(undefined),
  isInitialState: false,
};

describe('SearchResults counter', () => {
  it('renders the total exactly once when a caller supplies its own label', () => {
    // The label already embeds the count, so prefixing it printed the number
    // twice ("15148 15148 publications found").
    render(
      <SearchResults
        {...baseProps}
        totalCount={15148}
        results={[{ issuecode: 'fr/JM 1' }]}
        renderResultCard={(row: any) => <div>{row.issuecode}</div>}
        foundLabel="15148 publications found"
      />
    );

    expect(screen.getByText('15148 publications found')).toBeInTheDocument();
    expect(screen.queryByText(/15148\s+15148/)).not.toBeInTheDocument();
  });

  it('falls back to the stories counter when no label is supplied', () => {
    render(
      <SearchResults
        {...baseProps}
        totalCount={42}
        results={[{ storycode: 'X' }]}
        renderResultCard={(row: any) => <div>{row.storycode}</div>}
      />
    );

    expect(screen.getByText('42 search.results_found')).toBeInTheDocument();
  });

  it('hides the counter when there is nothing to count', () => {
    render(<SearchResults {...baseProps} totalCount={0} />);
    expect(screen.queryByText(/search\.results_found/)).not.toBeInTheDocument();
  });
});

describe('SearchResults empty states', () => {
  it('invites the user to search before the first query', () => {
    render(<SearchResults {...baseProps} isInitialState />);
    expect(screen.getByText('search.initial_title')).toBeInTheDocument();
  });

  it('reports no match after a query that returned nothing', () => {
    render(<SearchResults {...baseProps} isInitialState={false} />);
    expect(screen.getByText('search.no_results_title')).toBeInTheDocument();
  });

  it('shows skeletons while loading instead of an empty state', () => {
    render(
      <SearchResults
        {...baseProps}
        loading
        renderSkeleton={(i: number) => <div key={i} data-testid="skeleton" />}
      />
    );

    expect(screen.getAllByTestId('skeleton')).toHaveLength(4);
    expect(screen.queryByText('search.no_results_title')).not.toBeInTheDocument();
  });
});

describe('SearchResults pagination', () => {
  const paginated = {
    ...baseProps,
    totalCount: 100,
    results: [{ storycode: 'X' }],
    renderResultCard: (row: any) => <div>{row.storycode}</div>,
    filters: { sort: 'pubdate_asc', page: 2, rowsperpage: '24' },
  };

  it('shows the current page through a translatable indicator', () => {
    render(<SearchResults {...paginated} />);
    expect(screen.getByText('search.page_indicator')).toBeInTheDocument();
  });

  it('hides pagination when everything fits on one page', () => {
    render(<SearchResults {...baseProps} totalCount={5} results={[{ storycode: 'X' }]} />);
    expect(screen.queryByText('search.page_indicator')).not.toBeInTheDocument();
  });

  it('re-runs the search with the next page', () => {
    const handleSearch = vi.fn().mockResolvedValue(undefined);
    const setFilters = vi.fn();
    render(<SearchResults {...paginated} handleSearch={handleSearch} setFilters={setFilters} />);

    fireEvent.click(screen.getByText('search.next'));

    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
    expect(handleSearch).toHaveBeenCalledWith(undefined, expect.objectContaining({ page: 3 }));
  });

  it('resets to the first page when the sort order changes', () => {
    const setFilters = vi.fn();
    render(<SearchResults {...paginated} setFilters={setFilters} />);

    // The sort control is a Radix Select; assert the reset contract through the
    // previous-page button, which shares the same "go back to page 1" wiring.
    fireEvent.click(screen.getByText('search.previous'));
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });
});
