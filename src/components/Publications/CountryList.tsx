import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Globe, LibraryBig } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFlagUrl } from "@/lib/utils";
import { sortCountries, isMostIssuesSort } from "@/lib/countrySort";
import { useSharedSort } from "@/hooks/useSharedSort";

interface CountryInfo {
  countrycode: string;
  countryname: string;
  pubCount: number;
  maxIssueCount: number;
}

interface CountryListProps {
  onSelectCountry: (code: string) => void;
}

export function CountryList({ onSelectCountry }: CountryListProps) {
  const { t, i18n } = useTranslation();
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  // Shared with CountryPublications: picking "most issues" on either screen
  // also reorders the countries here.
  const [sortOrder, handleSortChange] = useSharedSort("title_asc");

  useEffect(() => {
    const fetchCountries = async () => {
      setLoading(true);
      try {
        const result = await executeQuery({
          sql: `
            SELECT c.countrycode,
                   COALESCE((SELECT cn.countryname FROM inducks_countryname cn WHERE cn.countrycode = c.countrycode AND cn.languagecode = ? LIMIT 1), c.countryname) as countryname,
                   (SELECT COUNT(*) FROM inducks_publication WHERE countrycode = c.countrycode) as pubCount,
                   -- Issue count of the country's biggest publication: the
                   -- criterion the "most issues" sort bubbles up to countries.
                   COALESCE((SELECT MAX(cnt) FROM (
                     SELECT COUNT(*) as cnt
                     FROM inducks_issue i
                     JOIN inducks_publication p ON i.publicationcode = p.publicationcode
                     WHERE p.countrycode = c.countrycode
                     GROUP BY i.publicationcode
                   )), 0) as maxIssueCount
            FROM inducks_country c
            ORDER BY countryname ASC
          `,
          args: [i18n.language?.split("-")[0] || "en"]
        });
        // Filter out countries that have 0 publications to avoid clutter
        const filtered = (result.rows as CountryInfo[]).filter(c => c.pubCount > 0);
        setCountries(filtered);
      } catch (err) {
        console.error("Error fetching countries:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCountries();
  }, []);

  const filteredCountries = React.useMemo(() => {
    const filtered = countries.filter(c => {
      return c.countryname.toLowerCase().includes(filterText.toLowerCase()) ||
             c.countrycode.toLowerCase().includes(filterText.toLowerCase());
    });
    return sortCountries(filtered, sortOrder);
  }, [countries, filterText, sortOrder]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {t("countries.title")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("countries.desc")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Input
            placeholder={t("countries.search_placeholder")}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full sm:w-64 rounded-xl h-10 border-border-subtle bg-surface"
          />
          <Select value={isMostIssuesSort(sortOrder) ? "issues_desc" : "title_asc"} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-48 h-10 border-border-subtle bg-surface rounded-xl text-sm">
              <SelectValue placeholder={t("sort.title_az")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border-subtle bg-surface">
              <SelectItem value="title_asc" className="rounded-lg">{t("sort.title_az")}</SelectItem>
              <SelectItem value="issues_desc" className="rounded-lg">{t("sort.issues_desc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pr-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredCountries.map((c) => {
            const flagUrl = getFlagUrl(c.countrycode);
            return (
              <Card
                key={c.countrycode}
                onClick={() => onSelectCountry(c.countrycode)}
                className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/20 hover:shadow-md transition-all duration-300 flex items-center gap-3.5 border border-border-subtle bg-surface/50 rounded-2xl group"
              >
                {flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={c.countrycode}
                    className="w-8 h-5.5 rounded object-cover shadow-sm shrink-0 border border-border-subtle/10 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <Globe className="w-8 h-8 text-muted-foreground/30 shrink-0" />
                )}
                <div className="min-w-0 space-y-0.5">
                  <h3 className="font-semibold text-foreground truncate">
                    {c.countryname}
                  </h3>
                  <div className="text-[10px] text-muted-foreground">
                    <span>
                      {t("countries.publication_count", { count: c.pubCount })}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
