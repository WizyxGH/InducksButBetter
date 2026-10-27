import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { executeQuery } from "@/lib/db";
import { buildAdvancedSearchQuery, SearchFilters } from "@/lib/searchService";
import { handleDbError } from "@/lib/utils";
import { searchOcr } from "@/lib/ocrService";

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
  /** AbortController for in-flight OCR requests. */
  const ocrAbortRef = useRef<AbortController | null>(null);

  const executeLocalQuery = async (query: string, params: any[]) => {
    const res: any[] = [];
    await executeQuery({ sql: query, args: params }, (row) => res.push(row));
    return res;
  };

  const performSearch = async (searchFilters: SearchFilters) => {
    const runId = ++searchRunId.current;
    /** True while a newer search has superseded this one. */
    const isStale = () => runId !== searchRunId.current;

    // Cancel any previous OCR request
    ocrAbortRef.current?.abort();
    ocrAbortRef.current = new AbortController();

    setLoading(true);
    try {
      let ocrEntrycodes: string[] | undefined;
      let ocrIssuecodes: string[] | undefined;

      // ── OCR pre-filter ────────────────────────────────────────────────────
      if (searchFilters.ocrText?.trim()) {
        const ocrResult = await searchOcr(searchFilters.ocrText, ocrAbortRef.current.signal);
        if (isStale()) return;

        if (ocrResult === null) {
          // Server unavailable
          toast.warning(t("search.ocr_unavailable", "Serveur transcript indisponible — filtre OCR ignoré"));

          // If the user only searched by OCR, do not execute an unconstrained scan over all stories.
          const hasOtherFilters = Boolean(
            searchFilters.title?.trim() ||
            searchFilters.keywords?.trim() ||
            searchFilters.description?.trim() ||
            searchFilters.storycode?.trim() ||
            searchFilters.charactercode ||
            searchFilters.country ||
            searchFilters.dateAfter ||
            searchFilters.dateBefore ||
            searchFilters.onlyCollection ||
            searchFilters.multipleParts ||
            searchFilters.universes ||
            searchFilters.subseriescode ||
            searchFilters.herocode ||
            (searchFilters.personRoles && searchFilters.personRoles.some((pr) => pr.code !== ''))
          );

          if (!hasOtherFilters) {
            setResults([]);
            setTotalCount(0);
            return;
          }
        } else if (ocrResult.entrycodes.length === 0) {
          // No OCR matches — short-circuit, no stories can match
          setResults([]);
          setTotalCount(0);
          return;
        } else {
          ocrEntrycodes = ocrResult.entrycodes;
          ocrIssuecodes = ocrResult.issuecodes;
        }
      }

      // The query builder normalises every multi-value filter itself
      // (see `normalizeList`), so arrays are passed through untouched.
      const filtersForQuery: SearchFilters = {
        ...searchFilters,
        personRoles: searchFilters.personRoles?.filter((pr) => pr.code !== ""),
        lang: i18n.language,
        // The max-pages bound only applies once the user actually moved the slider,
        // otherwise its default (500) would silently exclude longer stories.
        pagesMax: pagesSliderMoved ? searchFilters.pagesMax : undefined,
        ocrEntrycodes,
        ocrIssuecodes,
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
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
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
