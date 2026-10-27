import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Library,
  PieChart,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { useCollection } from "@/hooks/useCollection";
import {
  getCollectionPublicationStats,
  getPublicationIssuesForCollection,
  type CollectionPublicationStat,
  type PublicationIssueItem,
} from "@/lib/dataService";
import { parseCollection, formatCollectionExport } from "@/lib/collection";
import { cn } from "@/lib/utils";

interface CollectionStatsProps {
  onSelectPublication: (publicationcode: string) => void;
  onSelectIssue: (issuecode: string) => void;
}

type SortField = "title" | "country" | "owned" | "total" | "missing" | "percentage";
type SortDirection = "asc" | "desc";

export function CollectionStats({ onSelectPublication, onSelectIssue }: CollectionStatsProps) {
  const { t } = useTranslation();
  const { issues, count, saveCollection, hasIssue, toggleIssue } = useCollection();

  // Active view tab: "stats" or "import_export"
  const [activeTab, setActiveTab] = useState<"stats" | "import_export">("stats");

  // Statistics state
  const [stats, setStats] = useState<CollectionPublicationStat[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("percentage");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Expanded publication details for inspecting issues
  const [expandedPubCode, setExpandedPubCode] = useState<string | null>(null);
  const [expandedPubIssues, setExpandedPubIssues] = useState<PublicationIssueItem[]>([]);
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  // Import/Export textarea state
  const [exportText, setExportText] = useState("");

  // Sync exportText with current collection when switching to import_export tab
  useEffect(() => {
    if (activeTab === "import_export") {
      setExportText(formatCollectionExport(issues));
    }
  }, [activeTab, issues]);

  // Load publication stats whenever collection changes
  const fetchStats = useCallback(async () => {
    if (issues.length === 0) {
      setStats([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getCollectionPublicationStats(issues);
      setStats(data);
    } catch (err) {
      console.error("Failed to load publication stats", err);
      toast.error(t("collection.error_loading_stats"));
    } finally {
      setLoading(false);
    }
  }, [issues, t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Handle expanding a publication row to view owned/missing issues
  const toggleExpandPublication = async (publicationcode: string) => {
    if (expandedPubCode === publicationcode) {
      setExpandedPubCode(null);
      setExpandedPubIssues([]);
      return;
    }

    setExpandedPubCode(publicationcode);
    setLoadingExpanded(true);
    try {
      const pubIssues = await getPublicationIssuesForCollection(publicationcode);
      setExpandedPubIssues(pubIssues);
    } catch (err) {
      console.error("Failed to load issues for publication", err);
    } finally {
      setLoadingExpanded(false);
    }
  };

  // Distinct countries available in user's collection stats
  const availableCountries = useMemo(() => {
    const map = new Map<string, string>();
    stats.forEach((s) => {
      if (s.countrycode) {
        map.set(s.countrycode, s.countryname || s.countrycode);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [stats]);

  // Filtered and sorted stats
  const filteredStats = useMemo(() => {
    return stats
      .filter((s) => {
        if (selectedCountry !== "all" && s.countrycode !== selectedCountry) {
          return false;
        }
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchTitle = (s.publication_title || "").toLowerCase().includes(term);
          const matchCode = (s.publicationcode || "").toLowerCase().includes(term);
          const matchCountry = (s.countryname || "").toLowerCase().includes(term);
          if (!matchTitle && !matchCode && !matchCountry) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        switch (sortField) {
          case "title":
            diff = a.publication_title.localeCompare(b.publication_title);
            break;
          case "country":
            diff = a.countryname.localeCompare(b.countryname);
            break;
          case "owned":
            diff = a.owned_issues - b.owned_issues;
            break;
          case "total":
            diff = a.total_issues - b.total_issues;
            break;
          case "missing":
            diff = a.missing_issues - b.missing_issues;
            break;
          case "percentage":
          default:
            diff = a.percentage - b.percentage;
            break;
        }
        return sortDirection === "asc" ? diff : -diff;
      });
  }, [stats, selectedCountry, searchTerm, sortField, sortDirection]);

  // KPIs
  const kpis = useMemo(() => {
    const totalOwned = count;
    const startedPubs = stats.length;
    const completedPubs = stats.filter((s) => s.owned_issues >= s.total_issues && s.total_issues > 0).length;
    const totalExpectedIssues = stats.reduce((acc, s) => acc + s.total_issues, 0);
    const totalOwnedOnStarted = stats.reduce((acc, s) => acc + s.owned_issues, 0);
    const overallPercentage =
      totalExpectedIssues > 0
        ? Math.min(100, Math.round((totalOwnedOnStarted / totalExpectedIssues) * 100))
        : 0;

    return {
      totalOwned,
      startedPubs,
      completedPubs,
      overallPercentage,
    };
  }, [count, stats]);

  // Handle column header sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "percentage" || field === "owned" ? "desc" : "asc");
    }
  };

  // Import from textarea
  const handleSaveTextarea = () => {
    const parsed = parseCollection(exportText);
    saveCollection(parsed);
    toast.success(t("collection.saved_success"));
  };

  // Import from local .txt file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseCollection(text);
        saveCollection(parsed);
        setExportText(formatCollectionExport(parsed));
        toast.success(t("collection.import_file_success", { count: parsed.length }));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export to downloadable .txt file
  const handleDownloadExport = () => {
    const content = formatCollectionExport(issues);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inducks_collection_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t("collection.export_downloaded"));
  };

  // Clear collection
  const handleClearCollection = () => {
    if (window.confirm(t("collection.confirm_clear"))) {
      saveCollection([]);
      setExportText("");
      toast.info(t("collection.cleared"));
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BookmarkCheck className="w-6 h-6 text-primary" />
            {t("collection.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("collection.hero_subtitle")}
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-xl border border-border-subtle self-start sm:self-auto">
          <Button
            variant={activeTab === "stats" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("stats")}
            className="rounded-lg text-xs gap-1.5 h-8"
          >
            <PieChart className="w-3.5 h-3.5" />
            {t("collection.tab_completeness")}
          </Button>
          <Button
            variant={activeTab === "import_export" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("import_export")}
            className="rounded-lg text-xs gap-1.5 h-8"
          >
            <FileText className="w-3.5 h-3.5" />
            {t("collection.tab_import_export")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("collection.kpi_owned_issues")}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground font-mono">{kpis.totalOwned}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("collection.kpi_started_pubs")}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground font-mono">{kpis.startedPubs}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("collection.kpi_completed_pubs")}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground font-mono">{kpis.completedPubs}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("collection.kpi_overall_percentage")}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground font-mono">{kpis.overallPercentage}%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {activeTab === "stats" ? (
        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border-subtle space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Library className="w-5 h-5 text-primary" />
                  {t("collection.completeness_by_publication")}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {t("collection.completeness_description")}
                </CardDescription>
              </div>

              {/* Refresh stats button */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={loading}
                className="rounded-xl gap-1.5 h-8 self-start md:self-auto text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                {t("collection.refresh")}
              </Button>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {/* Search publication */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("collection.search_placeholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border-subtle bg-surface-2/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Filter Country */}
              <div className="relative shrink-0 sm:w-64">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-border-subtle bg-surface-2/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                >
                  <option value="all">{t("collection.all_countries")} ({stats.length})</option>
                  {availableCountries.map(([code, name]) => {
                    const countInCountry = stats.filter((s) => s.countrycode === code).length;
                    return (
                      <option key={code} value={code}>
                        {name} ({countInCountry})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-8">
                <PageLoadingSkeleton />
              </div>
            ) : issues.length === 0 ? (
              /* Empty state */
              <div className="p-12 text-center space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <BookmarkCheck className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{t("collection.empty_title")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("collection.empty_desc")}
                </p>
                <div className="pt-2">
                  <Button
                    onClick={() => setActiveTab("import_export")}
                    className="rounded-xl gap-2 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {t("collection.import_now")}
                  </Button>
                </div>
              </div>
            ) : filteredStats.length === 0 ? (
              /* Filter empty state */
              <div className="p-12 text-center text-muted-foreground">
                <p>{t("collection.no_results_filter")}</p>
              </div>
            ) : (
              /* Responsive Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-2/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("title")}
                      >
                        <div className="flex items-center gap-1.5">
                          {t("collection.col_publication")}
                          {sortField === "title" && (
                            sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("country")}
                      >
                        <div className="flex items-center gap-1.5">
                          {t("collection.col_country")}
                          {sortField === "country" && (
                            sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-foreground select-none text-right"
                        onClick={() => handleSort("owned")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {t("collection.col_owned")}
                          {sortField === "owned" && (
                            sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-foreground select-none text-right"
                        onClick={() => handleSort("total")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {t("collection.col_total")}
                          {sortField === "total" && (
                            sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-foreground select-none text-right"
                        onClick={() => handleSort("missing")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {t("collection.col_missing")}
                          {sortField === "missing" && (
                            sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-foreground select-none sm:w-56"
                        onClick={() => handleSort("percentage")}
                      >
                        <div className="flex items-center gap-1.5">
                          {t("collection.col_completeness")}
                          {sortField === "percentage" && (
                            sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center select-none w-24">
                        {t("collection.col_actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filteredStats.map((item) => {
                      const isExpanded = expandedPubCode === item.publicationcode;
                      const isComplete = item.percentage >= 100;

                      return (
                        <React.Fragment key={item.publicationcode}>
                          <tr className={cn("hover:bg-surface-2/50 transition-colors", isExpanded && "bg-surface-2/30")}>
                            {/* Publication title & code */}
                            <td className="py-3.5 px-4 font-medium text-foreground">
                              <button
                                onClick={() => onSelectPublication(item.publicationcode)}
                                className="text-left hover:text-primary transition-colors font-semibold flex items-center gap-1.5 group"
                              >
                                <span>{item.publication_title}</span>
                                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                              </button>
                              <span className="text-[11px] font-mono text-muted-foreground block">
                                {item.publicationcode}
                              </span>
                            </td>

                            {/* Country */}
                            <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                              <Badge variant="outline" className="font-normal text-xs bg-surface-2/40">
                                {item.countryname}
                              </Badge>
                            </td>

                            {/* Owned */}
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground">
                              {item.owned_issues}
                            </td>

                            {/* Total */}
                            <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                              {item.total_issues}
                            </td>

                            {/* Missing */}
                            <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                              {item.missing_issues > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  {item.missing_issues}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">0</span>
                              )}
                            </td>

                            {/* Completeness bar & % */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className={cn(
                                      "font-mono font-bold text-xs",
                                      isComplete
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : item.percentage >= 50
                                          ? "text-primary"
                                          : "text-muted-foreground"
                                    )}
                                  >
                                    {item.percentage}%
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {item.owned_issues}/{item.total_issues}
                                  </span>
                                </div>
                                <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-border-subtle">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      isComplete
                                        ? "bg-emerald-500"
                                        : item.percentage >= 50
                                          ? "bg-primary"
                                          : "bg-amber-500"
                                    )}
                                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Actions / Expand details */}
                            <td className="py-3.5 px-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpandPublication(item.publicationcode)}
                                className="h-8 px-2 text-xs rounded-lg gap-1"
                                title={t("collection.toggle_details")}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-primary" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </td>
                          </tr>

                          {/* Expanded issues inspection drawer */}
                          {isExpanded && (
                            <tr className="bg-surface-2/20">
                              <td colSpan={7} className="p-4 sm:p-6 border-b border-border-subtle">
                                {loadingExpanded ? (
                                  <div className="p-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                                    {t("common.loading")}
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {t("collection.issues_breakdown", { title: item.publication_title })}
                                      </h4>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onSelectPublication(item.publicationcode)}
                                        className="h-7 text-xs rounded-lg gap-1.5"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        {t("publication.view_all_issues")}
                                      </Button>
                                    </div>

                                    {/* Grid of issues */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-80 overflow-y-auto p-1">
                                      {expandedPubIssues.map((iss) => {
                                        const owned = hasIssue(iss.issuecode);
                                        return (
                                          <div
                                            key={iss.issuecode}
                                            className={cn(
                                              "p-2 rounded-xl border text-xs flex flex-col justify-between transition-colors",
                                              owned
                                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                                                : "border-border-subtle bg-surface text-muted-foreground hover:border-primary/40"
                                            )}
                                          >
                                            <div className="flex items-start justify-between gap-1">
                                              <button
                                                onClick={() => onSelectIssue(iss.issuecode)}
                                                className="font-bold font-mono hover:text-primary transition-colors text-left line-clamp-1"
                                                title={iss.issue_title || iss.issuenumber}
                                              >
                                                {iss.issuenumber}
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const added = toggleIssue(iss.issuecode);
                                                  toast.success(
                                                    added
                                                      ? t("collection.issue_added")
                                                      : t("collection.issue_removed")
                                                  );
                                                }}
                                                className="hover:scale-110 transition-transform p-0.5 rounded text-muted-foreground hover:text-primary"
                                                title={owned ? t("collection.remove") : t("collection.add")}
                                              >
                                                {owned ? (
                                                  <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                ) : (
                                                  <Plus className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                            </div>
                                            {iss.oldestdate && iss.oldestdate !== "0000-00-00" && (
                                              <span className="text-[10px] text-muted-foreground mt-1">
                                                {iss.oldestdate.slice(0, 4)}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Tab: Import / Export */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
              <CardHeader className="p-4 sm:p-6 border-b border-border-subtle">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {t("collection.import_export_title")}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {t("collection.import_export_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <textarea
                  className="w-full h-80 rounded-xl border border-border-subtle bg-surface-2/40 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                  placeholder={t("collection.placeholder")}
                  value={exportText}
                  onChange={(e) => setExportText(e.target.value)}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-muted-foreground font-mono">
                    {t("collection.detected_count", {
                      count: parseCollection(exportText).length,
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSaveTextarea}
                      className="rounded-xl gap-1.5 shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      {t("collection.save")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick sync tools */}
          <div className="space-y-4">
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  {t("collection.sync_tools")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
                {/* File Upload */}
                <div className="relative">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    id="collection-file-input"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full rounded-xl gap-2 justify-start h-10"
                    onClick={() => document.getElementById("collection-file-input")?.click()}
                  >
                    <Upload className="w-4 h-4 text-primary" />
                    <span>{t("collection.btn_import_file")}</span>
                  </Button>
                </div>

                {/* File Download */}
                <Button
                  variant="outline"
                  className="w-full rounded-xl gap-2 justify-start h-10"
                  onClick={handleDownloadExport}
                  disabled={issues.length === 0}
                >
                  <Download className="w-4 h-4 text-primary" />
                  <span>{t("collection.btn_download_export")}</span>
                </Button>

                {/* Clear collection */}
                <Button
                  variant="ghost"
                  className="w-full rounded-xl gap-2 justify-start h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleClearCollection}
                  disabled={issues.length === 0}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t("collection.btn_clear_collection")}</span>
                </Button>
              </CardContent>
            </Card>

            {/* Official Inducks Guide Box */}
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  {t("collection.inducks_guide_title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2 text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>{t("collection.inducks_guide_p1")}</p>
                <ol className="list-decimal list-inside space-y-1 pt-1 font-sans">
                  <li>{t("collection.inducks_guide_step1")}</li>
                  <li>{t("collection.inducks_guide_step2")}</li>
                  <li>{t("collection.inducks_guide_step3")}</li>
                </ol>
                <div className="pt-2">
                  <a
                    href="https://inducks.org/collection.php"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    inducks.org/collection.php
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

