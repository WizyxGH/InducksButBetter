import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { useMetadata } from "@/hooks/useMetadata";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import { useSearchExecution } from "@/hooks/useSearchExecution";
import { SearchForm } from "./Search/SearchForm";
import { SearchResults } from "./Search/SearchResults";
import { exportSearchResultsToCsv } from "@/lib/searchService";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { StoryDetail } from "./Search/StoryDetail";
import { navigateBack } from "@/lib/utils";
import { IssueDetail } from "./Publications/IssueDetail";
import { navigate } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import StoryResultSkeleton from "./StoryResultSkeleton";

interface AdvancedSearchProps {
  selectedStorycode: string | null;
  setSelectedStorycode: (code: string | null) => void;
  selectedIssuecode: string | null;
  setSelectedIssuecode: (code: string | null) => void;
}

export function AdvancedSearch({
  selectedStorycode,
  setSelectedStorycode,
  selectedIssuecode,
  setSelectedIssuecode
}: AdvancedSearchProps) {
  const { meta } = useMetadata();
  const {
    filters,
    setFilters,
    pagesSliderMoved,
    setPagesSliderMoved,
    selectedLabels,
    setSelectedLabels,
    cookieValue,
    setCookieValue,
    isSavingCookie,
    isSettingsOpen,
    setIsSettingsOpen,
    addSelection,
    removeSelection,
    saveCookie,
    handleClearFilters,
  } = useSearchFilters();

  const {
    results,
    totalCount,
    loading,
    setResults,
    setTotalCount,
    handleSearch,
    lastSearchFilters,
    lastExecutedQuery,
    executeLocalQuery,
  } = useSearchExecution({
    filters,
    pagesSliderMoved,
  });

  const { t, i18n } = useTranslation();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportCsv = async () => {
    if (!lastSearchFilters) return;
    try {
      setIsExporting(true);
      const blob = await exportSearchResultsToCsv(lastSearchFilters, i18n.language, executeLocalQuery, t);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inducks_stories_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("search.export_success"));
    } catch (e) {
      console.error(e);
      toast.error(t("search.export_error"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySql = () => {
    if (!lastExecutedQuery) return;
    
    // Simple regex to replace ? with actual params
    // We remove the pagination limit so the query returns all results
    let sql = lastExecutedQuery.sql.replace(/LIMIT \? OFFSET \?/g, "");
    const args = lastExecutedQuery.args ? [...lastExecutedQuery.args] : [];
    
    // The last two arguments are always pageSize and offset. 
    // Remove them from the copied arguments.
    if (args.length >= 2) {
      args.splice(args.length - 2, 2);
    }
    
    let argIndex = 0;
    sql = sql.replace(/\?/g, () => {
      const val = args[argIndex++];
      if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
      if (val === null || val === undefined) return "NULL";
      return String(val);
    });

    navigator.clipboard.writeText(sql).catch(console.error);
  };

  const handleSelectCharacter = (code: string, name: string) => {
    navigate(routes.character(code));
  };

  if (selectedIssuecode) {
    return (
      <div className="h-full overflow-auto bg-surface-2/20">
        <IssueDetail
          issuecode={selectedIssuecode}
          onBack={() => setSelectedIssuecode(null)}
          onSelectStory={(code) => {
            setSelectedStorycode(code);
            setSelectedIssuecode(null);
          }}
        />
      </div>
    );
  }

  if (selectedStorycode) {
    return (
      <div className="h-full overflow-auto bg-surface-2/20">
        <StoryDetail
          storycode={selectedStorycode}
          onBack={() => navigateBack(() => setSelectedStorycode(null))}
          onSelectIssue={(code) => setSelectedIssuecode(code)}
          onSelectCharacter={handleSelectCharacter}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto lg:overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 lg:p-8 gap-8 px-4 lg:px-12 pb-12 lg:pb-8">
        <SearchForm
          filters={filters}
          setFilters={setFilters}
          pagesSliderMoved={pagesSliderMoved}
          setPagesSliderMoved={setPagesSliderMoved}
          selectedLabels={selectedLabels}
          setSelectedLabels={setSelectedLabels}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          cookieValue={cookieValue}
          setCookieValue={setCookieValue}
          isSavingCookie={isSavingCookie}
          saveCookie={saveCookie}
          addSelection={addSelection}
          removeSelection={removeSelection}
          handleClearFilters={handleClearFilters}
          handleSearch={handleSearch}
          loading={loading}
          meta={meta}
          setResults={setResults}
          setTotalCount={setTotalCount}
        />
        <SearchResults
          results={results}
          totalCount={totalCount}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          handleSearch={handleSearch}
          isInitialState={lastSearchFilters === null}
          renderSkeleton={(i) => <StoryResultSkeleton key={i} />}
          onSelect={(code) => setSelectedStorycode(code)}
          onSelectCharacter={handleSelectCharacter}
          exportCsv={handleExportCsv}
          isExporting={isExporting}
          copySql={handleCopySql}
        />
      </div>
    </div>
  );
}
