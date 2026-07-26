import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronLeft, LibraryBig, FileText } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFlagUrl, cleanComment, cleanPublisherName } from "@/lib/utils";

interface PublicationInfo {
  publicationcode: string;
  title: string;
  languagecode: string;
  publicationcomment?: string;
  issueCount: number;
  publishername?: string;
}

interface CountryPublicationsProps {
  countrycode: string;
  onBack: () => void;
  onSelectPublication: (code: string) => void;
}

export function CountryPublications({ countrycode, onBack, onSelectPublication }: CountryPublicationsProps) {
  const { t } = useTranslation();
  const [countryName, setCountryName] = useState("");
  const [publications, setPublications] = useState<PublicationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [sortOrder, setSortOrder] = useState("title_asc");
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch country name
        const countryRes = await executeQuery({
          sql: "SELECT countryname FROM inducks_country WHERE countrycode = ?",
          args: [countrycode]
        });
        if (countryRes.rows.length > 0) {
          setCountryName(countryRes.rows[0].countryname);
        } else {
          setCountryName(countrycode.toUpperCase());
        }

        // Fetch publications
        const result = await executeQuery({
          sql: `
            SELECT p.publicationcode, 
                   COALESCE((SELECT pn.publicationname FROM inducks_publicationname pn WHERE pn.publicationcode = p.publicationcode LIMIT 1), p.title) as title, 
                   p.languagecode, p.publicationcomment,
                   (SELECT COUNT(*) FROM inducks_issue WHERE publicationcode = p.publicationcode) as issueCount,
                   (SELECT pub.publishername 
                    FROM inducks_publishingjob pj 
                    JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid 
                    JOIN inducks_issue i ON pj.issuecode = i.issuecode
                    WHERE i.publicationcode = p.publicationcode 
                    LIMIT 1) as publishername
            FROM inducks_publication p
            WHERE p.countrycode = ?
          `,
          args: [countrycode]
        });
        // Filter out publications that have 0 issues to avoid clutter
        const filtered = (result.rows as PublicationInfo[]).filter(p => p.issueCount > 0);
        setPublications(filtered);
        setVisibleCount(30); // reset visible count on new country load
      } catch (err) {
        console.error("Error fetching country publications:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [countrycode]);

  const filteredPublications = React.useMemo(() => {
    let filtered = publications.filter(p => 
      p.title.toLowerCase().includes(filterText.toLowerCase()) ||
      p.publicationcode.toLowerCase().includes(filterText.toLowerCase())
    );
    if (sortOrder === "title_asc") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === "title_desc") {
      filtered.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortOrder === "issues_desc") {
      filtered.sort((a, b) => b.issueCount - a.issueCount);
    } else if (sortOrder === "issues_asc") {
      filtered.sort((a, b) => a.issueCount - b.issueCount);
    }
    return filtered;
  }, [publications, filterText, sortOrder]);

  // Reset pagination limit when filter or sort changes
  useEffect(() => {
    setVisibleCount(30);
  }, [filterText, sortOrder]);

  const displayedPublications = React.useMemo(() => {
    return filteredPublications.slice(0, visibleCount);
  }, [filteredPublications, visibleCount]);

  const flagUrl = getFlagUrl(countrycode);

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
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 rounded-xl border border-border-subtle hover:bg-surface-2"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 truncate">
              <span>{t("countryPubs.title_prefix") || "Publications de"}</span>
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt={countrycode}
                  className="w-6 h-4.5 rounded object-cover shadow-xs border border-border-subtle/10 shrink-0"
                />
              )}
              <span>{countryName}</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("countryPubs.desc") || "Explorez les magazines et séries Disney publiés dans ce pays."}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Input
            placeholder={t("countryPubs.search_placeholder") || "Filtrer les publications..."}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full sm:w-64 rounded-xl h-10 border-border-subtle bg-surface"
          />
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full sm:w-48 h-10 border-border-subtle bg-surface rounded-xl text-sm">
              <SelectValue placeholder={t("sort.title_az") || "Trier par..."} />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border-subtle bg-surface">
              <SelectItem value="title_asc" className="rounded-lg">{t("sort.title_az") || "Titre A-Z"}</SelectItem>
              <SelectItem value="title_desc" className="rounded-lg">{t("sort.title_za") || "Titre Z-A"}</SelectItem>
              <SelectItem value="issues_desc" className="rounded-lg">{t("sort.issues_desc") || "Plus de numéros"}</SelectItem>
              <SelectItem value="issues_asc" className="rounded-lg">{t("sort.issues_asc") || "Moins de numéros"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedPublications.map((p) => (
            <Card
              key={p.publicationcode}
              onClick={() => onSelectPublication(p.publicationcode)}
              className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/20 hover:shadow-md transition-all duration-300 flex justify-between items-center gap-4 border border-border-subtle bg-surface/50 rounded-2xl group"
            >
              <div className="min-w-0 space-y-0.5 flex-1">
                <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors leading-tight">
                  {p.title || "Sans titre"}
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono">{p.publicationcode}</p>
                {p.publishername && (
                  <p className="text-[10px] text-primary/80 font-medium mt-1">
                    {cleanPublisherName(p.publishername)}
                  </p>
                )}
                {p.publicationcomment && (
                  <p className="text-[10.5px] text-text-secondary italic line-clamp-2 mt-1.5 pt-0.5">
                    {cleanComment(p.publicationcomment)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-surface-2 px-3 py-1 rounded-xl border border-border-subtle shrink-0">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>
                  {p.issueCount} {p.issueCount > 1 ? t("publication.issues_plural", "issues") : t("publication.issue_singular", "issue")}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {filteredPublications.length > visibleCount && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setVisibleCount(prev => prev + 30)}
              variant="outline"
              className="rounded-xl border-border-subtle hover:bg-surface-2 font-medium px-6"
            >
              Afficher plus
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
