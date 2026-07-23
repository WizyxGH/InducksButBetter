import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronLeft, LibraryBig, FileText } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFlagUrl } from "@/lib/utils";

interface PublicationInfo {
  publicationcode: string;
  title: string;
  languagecode: string;
  countrycode: string;
  publicationcomment?: string;
  issueCount: number;
}

interface PublisherDetailProps {
  publisherid: string;
  onBack: () => void;
  onSelectPublication: (code: string) => void;
}

export function PublisherDetail({ publisherid, onBack, onSelectPublication }: PublisherDetailProps) {
  const { t } = useTranslation();
  const [publisherName, setPublisherName] = useState("");
  const [publisherCountry, setPublisherCountry] = useState(publisherid.includes("/") ? publisherid.split("/")[0] : "");
  const [publications, setPublications] = useState<PublicationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [sortOrder, setSortOrder] = useState("title_asc");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch publisher details
        const pubRes = await executeQuery({
          sql: "SELECT publishername FROM inducks_publisher WHERE publisherid = ?",
          args: [publisherid]
        });
        if (pubRes.rows.length > 0) {
          setPublisherName(pubRes.rows[0].publishername as string);
        } else {
          setPublisherName(publisherid);
        }

        // Fetch publications edited by this publisher
        const result = await executeQuery({
          sql: `
            SELECT p.publicationcode, 
                   COALESCE((SELECT pn.publicationname FROM inducks_publicationname pn WHERE pn.publicationcode = p.publicationcode LIMIT 1), p.title) as title, 
                   p.languagecode, p.countrycode, p.publicationcomment,
                   COUNT(DISTINCT i.issuecode) as issueCount
            FROM inducks_publishingjob pj
            JOIN inducks_issue i ON pj.issuecode = i.issuecode
            JOIN inducks_publication p ON i.publicationcode = p.publicationcode
            WHERE pj.publisherid = ?
            GROUP BY p.publicationcode, title, p.languagecode, p.countrycode, p.publicationcomment
          `,
          args: [publisherid]
        });
        
        // Filter out publications that have 0 issues for this publisher
        const filtered = (result.rows as PublicationInfo[]).filter(p => p.issueCount > 0);
        setPublications(filtered);
      } catch (err) {
        console.error("Error fetching publisher details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [publisherid]);

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

  const flagUrl = getFlagUrl(publisherCountry);

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
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt={publisherCountry}
                  className="w-6 h-4.5 rounded object-cover shadow-xs border border-border-subtle/10 shrink-0"
                />
              )}
              {t("publisher.title", { publisher: publisherName }) || `Éditeur : ${publisherName}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Explorez les magazines et séries édités par cette maison d'édition.
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
              <SelectValue placeholder="Trier par..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border-subtle bg-surface">
              <SelectItem value="title_asc" className="rounded-lg">Titre A-Z</SelectItem>
              <SelectItem value="title_desc" className="rounded-lg">Titre Z-A</SelectItem>
              <SelectItem value="issues_desc" className="rounded-lg">Plus de numéros</SelectItem>
              <SelectItem value="issues_asc" className="rounded-lg">Moins de numéros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPublications.map((p) => (
            <Card
              key={p.publicationcode}
              onClick={() => onSelectPublication(p.publicationcode)}
              className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/20 hover:shadow-md transition-all duration-300 flex justify-between items-center gap-4 border border-border-subtle bg-surface/50 rounded-2xl group"
            >
              <div className="min-w-0 space-y-0.5 flex-1">
                <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors leading-tight">
                  {p.title || "Sans titre"}
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                  {getFlagUrl(p.countrycode) && (
                    <img src={getFlagUrl(p.countrycode)} alt={p.countrycode} className="w-3.5 h-2.5 rounded object-cover shadow-xs opacity-80" />
                  )}
                  {p.publicationcode}
                </p>
                {p.publicationcomment && (
                  <p className="text-[10.5px] text-text-secondary italic line-clamp-2 mt-1.5 pt-0.5">
                    "{p.publicationcomment}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-surface-2 px-3 py-1 rounded-xl border border-border-subtle shrink-0">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>
                  {p.issueCount} {p.issueCount > 1 ? "numéros" : "numéro"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
