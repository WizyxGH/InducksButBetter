import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { executeQuery } from "@/lib/db";
import { buildAdvancedSearchQuery, SearchFilters } from "@/lib/searchService";
import { handleDbError } from "@/lib/utils";

interface UseSearchExecutionProps {
  filters: SearchFilters;
  pagesSliderMoved: boolean;
}

export function useSearchExecution({ filters, pagesSliderMoved }: UseSearchExecutionProps) {
  const { t, i18n } = useTranslation();
  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastSearchFilters, setLastSearchFilters] = useState<SearchFilters | null>(null);
  const [lastExecutedQuery, setLastExecutedQuery] = useState<{ sql: string; args: any[] } | null>(null);
  /** Monotonic id used to discard results of superseded searches. */
  const searchRunId = useRef(0);

  const executeLocalQuery = async (query: string, params: any[]) => {
    const res: any[] = [];
    await executeQuery({ sql: query, args: params }, (row) => res.push(row));
    return res;
  };

  const performSearch = async (searchFilters: SearchFilters) => {
    const runId = ++searchRunId.current;
    /** True while a newer search has superseded this one. */
    const isStale = () => runId !== searchRunId.current;

    setLoading(true);
    try {
      // The query builder normalises every multi-value filter itself
      // (see `normalizeList`), so arrays are passed through untouched.
      const filtersForQuery: SearchFilters = {
        ...searchFilters,
        personRoles: searchFilters.personRoles?.filter((pr) => pr.code !== ""),
        lang: i18n.language,
        // The max-pages bound only applies once the user actually moved the slider,
        // otherwise its default (500) would silently exclude longer stories.
        pagesMax: pagesSliderMoved ? searchFilters.pagesMax : undefined,
      };

      const { query, countQuery, params, countParams } = buildAdvancedSearchQuery(filtersForQuery);

      setLastExecutedQuery({ sql: query, args: params });
      setResults([]);

      // Count and page fetch are independent: run them concurrently.
      const [countResult, mainResult] = await Promise.all([
        executeQuery({ sql: countQuery, args: countParams }),
        executeQuery({ sql: query, args: params }),
      ]);

      if (isStale()) return;

      setResults(mainResult?.rows ?? []);
      setTotalCount(Number(countResult?.rows?.[0]?.total ?? 0));
    } catch (err) {
      if (isStale()) return;
      handleDbError(err, t("search.error_fetch"));
      setResults([]);
      setTotalCount(0);
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  useEffect(() => {
    if (lastSearchFilters) {
      performSearch(lastSearchFilters);
    }
  }, [i18n.language]);

  const handleSearch = async (e?: React.FormEvent | null, overrideFilters?: SearchFilters) => {
    if (e) e.preventDefault();
    const currentFilters = overrideFilters || filters;
    setLastSearchFilters(currentFilters);
    await performSearch(currentFilters);
  };

  return {
    results,
    setResults,
    totalCount,
    setTotalCount,
    loading,
    lastSearchFilters,
    setLastSearchFilters,
    performSearch,
    handleSearch,
    lastExecutedQuery,
    executeLocalQuery,
  };
}
