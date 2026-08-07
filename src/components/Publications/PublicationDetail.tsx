import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronLeft, LibraryBig, FileText, Globe, BookOpen } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getFlagUrl, cleanComment, cleanPublisherName } from "@/lib/utils";
import { useMetadata } from "@/hooks/useMetadata";
import { buildIssueSections, issueDisplayNumber, type IssueRange } from "@/lib/publications";

interface PublicationDetailData {
  publicationcode: string;
  title: string;
  countrycode: string;
  languagecode: string;
  category?: string;
  publicationcomment?: string;
  publishername?: string;
  publisherid?: string;
  publishers?: { id: string; name: string }[];
}

interface PublicationDetailProps {
  publicationcode: string;
  onBack: () => void;
  onSelectIssue: (code: string) => void;
}

export function PublicationDetail({ publicationcode, onBack, onSelectIssue }: PublicationDetailProps) {
  const { t } = useTranslation();
  const { meta } = useMetadata();
  const [publication, setPublication] = useState<PublicationDetailData | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [ranges, setRanges] = useState<IssueRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [visibleSections, setVisibleSections] = useState(5);

  // Publications Inducks splits into `h2` issue ranges (fr/SPGHS and friends)
  // are shown range by range, like the reference site; the others keep the
  // year grouping.
  const sections = useMemo(
    () => buildIssueSections(issues, ranges, t("story.unknown_date")),
    [issues, ranges, t]
  );
  const groupedByRange = ranges.length > 0 && issues.some((i) => !!i.issuerangecode);

  const displayedSections = useMemo(
    () => sections.slice(0, visibleSections),
    [sections, visibleSections]
  );

  useEffect(() => {
    setVisibleSections(5);
    // Dropped eagerly so a new publication never renders against the previous
    // one's ranges.
    setRanges([]);
  }, [publicationcode]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch publication details and publisher
        let pubData = null;
        let hasPublicationRow = false;
        try {
          const pubResult = await executeQuery({
            sql: `
              SELECT p.publicationcode, p.title, p.countrycode, p.languagecode, p.publicationcomment,
                     (SELECT pub.publishername 
                      FROM inducks_publishingjob pj 
                      JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid 
                      JOIN inducks_issue i ON pj.issuecode = i.issuecode
                      WHERE i.publicationcode = p.publicationcode 
                      LIMIT 1) as publishername,
                     (SELECT pub.publisherid 
                      FROM inducks_publishingjob pj 
                      JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid 
                      JOIN inducks_issue i ON pj.issuecode = i.issuecode
                      WHERE i.publicationcode = p.publicationcode 
                      LIMIT 1) as publisherid,
                     (SELECT GROUP_CONCAT(category, ', ') FROM inducks_publicationcategory WHERE publicationcode = p.publicationcode) as category
              FROM inducks_publication p
              WHERE p.publicationcode = ?
            `,
            args: [publicationcode]
          });
          if (pubResult.rows.length > 0) {
            pubData = pubResult.rows[0] as PublicationDetailData;
            hasPublicationRow = true;

            try {
              const publishersResult = await executeQuery({
                sql: `
                  SELECT DISTINCT pub.publisherid, pub.publishername 
                  FROM inducks_publishingjob pj 
                  JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid 
                  JOIN inducks_issue i ON pj.issuecode = i.issuecode
                  WHERE i.publicationcode = ?
                `,
                args: [publicationcode]
              });
              if (publishersResult.rows && publishersResult.rows.length > 0) {
                pubData.publishers = publishersResult.rows.map((r: any) => ({
                  id: r.publisherid,
                  name: r.publishername
                }));
              }
            } catch (pubErr) {
              console.warn("Could not fetch multiple publishers", pubErr);
            }
          }
        } catch (e) {
          console.warn("Could not fetch publication details (missing table?):", e);
        }

        // A publication row may legitimately be missing while its issues are
        // present (an older dump, a broken `inducks_publication` table), so
        // the fallback identity is only built once issues have been found —
        // otherwise the code simply does not exist and must say so.
        if (!pubData) {
          const fallbackCountry = publicationcode.split('/')[0] || 'xx';
          pubData = {
            publicationcode: publicationcode,
            title: publicationcode, // fallback title
            countrycode: fallbackCountry,
            languagecode: fallbackCountry,
          };
        }

        // Fetch all issues of this publication.
        // Ordered by issue code, like the reference Inducks page: issue codes
        // are zero/space padded, so this is both chronological and the order
        // the `h2` ranges are declared in.
        let issueRows: any[] = [];
        try {
          // Try with full join
          const issuesResult = await executeQuery({
            sql: `
              SELECT i.issuecode, i.issuenumber, i.issuerangecode, i.title as issue_title, i.pages, i.price, i.oldestdate, i.size, i.attached,
                     p.title as series_title, p.countrycode, p.publicationcode,
                     (SELECT pub.publishername FROM inducks_publishingjob pj JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid WHERE pj.issuecode = i.issuecode LIMIT 1) as publishername,
                     (SELECT eu.sitecode || '|' || eu.url
                      FROM inducks_entry e
                      JOIN inducks_entryurl eu ON e.entrycode = eu.entrycode
                      WHERE e.issuecode = i.issuecode
                      LIMIT 1) as issue_thumb
              FROM inducks_issue i
              JOIN inducks_publication p ON i.publicationcode = p.publicationcode
              WHERE i.publicationcode = ?
              ORDER BY i.issuecode ASC
            `,
            args: [publicationcode]
          });
          issueRows = issuesResult.rows;
        } catch (e) {
          console.warn("Could not fetch issues with JOIN (missing table?). Trying fallback:", e);
          // Fallback without joining inducks_publication
          const fallbackResult = await executeQuery({
            sql: `
              SELECT i.issuecode, i.issuenumber, i.issuerangecode, i.title as issue_title, i.pages, i.price, i.oldestdate, i.size, i.attached,
                     ? as series_title, ? as countrycode, ? as publicationcode,
                     (SELECT eu.sitecode || '|' || eu.url
                      FROM inducks_entry e
                      JOIN inducks_entryurl eu ON e.entrycode = eu.entrycode
                      WHERE e.issuecode = i.issuecode
                      LIMIT 1) as issue_thumb
              FROM inducks_issue i
              WHERE i.publicationcode = ? OR i.issuecode LIKE ? || ' %'
              ORDER BY i.issuecode ASC
            `,
            args: [pubData.title, pubData.countrycode, pubData.publicationcode, publicationcode, publicationcode]
          });
          issueRows = fallbackResult.rows;
        }

        if (!hasPublicationRow && issueRows.length === 0) {
          setNotFound(true);
          setPublication(null);
          setIssues([]);
          setRanges([]);
          return;
        }

        setNotFound(false);
        setPublication(pubData);
        setIssues(issueRows);

        // The `h2` headers of the Inducks source files.
        try {
          const rangeResult = await executeQuery({
            sql: `
              SELECT issuerangecode, title, issuerangecomment, circulation
              FROM inducks_issuerange
              WHERE publicationcode = ?
              ORDER BY issuerangecode ASC
            `,
            args: [publicationcode]
          });
          setRanges(rangeResult.rows as IssueRange[]);
        } catch (e) {
          // Older dumps may not ship the table; year grouping still works.
          console.warn("Could not fetch issue ranges (missing table?):", e);
          setRanges([]);
        }
      } catch (err) {
        console.error("Error fetching publication detail:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [publicationcode]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !publication) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-9 w-9 rounded-xl border border-border-subtle hover:bg-surface-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="rounded-2xl border border-border-subtle bg-surface/50 p-8 text-center space-y-2">
          <p className="font-semibold text-foreground">{t("publication.not_found")}</p>
          <p className="text-xs text-muted-foreground font-mono">{publicationcode}</p>
          <p className="text-sm text-muted-foreground">{t("publication.not_found_desc")}</p>
        </div>
      </div>
    );
  }

  const flagUrl = publication ? getFlagUrl(publication.countrycode) : null;
  const countryName = meta.countries.find(c => c.countrycode === publication?.countrycode)?.countryname || publication?.countrycode.toUpperCase();
  const languageName = meta.languages.find(l => l.languagecode === publication?.languagecode)?.languagename || publication?.languagecode.toUpperCase();

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-3 shrink-0">
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
            <LibraryBig className="w-5 h-5 text-primary shrink-0" />
            {publication.title}
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{publication.publicationcode}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Side: Publication Metadata Card */}
        <div className="lg:col-span-1 space-y-6 shrink-0">
          <Card className="border-border-subtle bg-surface/50 rounded-2xl">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {t("common.informations")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex justify-between py-1 border-b border-border-subtle/30">
                <span className="font-bold text-muted-foreground">{t("publication.code")}</span>
                <span className="font-semibold text-foreground font-mono">{publication.publicationcode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle/30 items-center">
                <span className="font-bold text-muted-foreground">{t("publication.country")}</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  {flagUrl && (
                    <img
                      src={flagUrl}
                      alt={publication.countrycode}
                      className="w-4 h-3 rounded object-cover shadow-xs border border-border-subtle/10 shrink-0"
                    />
                  )}
                  {countryName}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle/30">
                <span className="font-bold text-muted-foreground">{t("publication.language")}</span>
                <span className="font-semibold text-foreground capitalize">{languageName}</span>
              </div>
              {publication.publishers && publication.publishers.length > 0 ? (
                <div className="flex justify-between py-1 border-b border-border-subtle/30">
                  <span className="font-bold text-muted-foreground">{t("publication.publisher")}</span>
                  <div className="flex flex-wrap justify-end gap-x-1 font-semibold text-foreground text-right max-w-[70%]">
                    {publication.publishers.map((pub, idx) => (
                      <React.Fragment key={pub.id || idx}>
                        <span 
                          className="cursor-pointer hover:text-primary transition-colors hover:underline"
                          onClick={() => {
                            if (pub.id) {
                              window.location.hash = `#/publishers/${encodeURIComponent(pub.id)}`;
                            }
                          }}
                        >
                          {pub.name}
                        </span>
                        {idx < publication.publishers!.length - 1 && <span className="text-muted-foreground mr-0.5">,</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : publication.publishername ? (
                <div className="flex justify-between py-1 border-b border-border-subtle/30">
                  <span className="font-bold text-muted-foreground">{t("publication.publisher")}</span>
                  <span 
                    className="font-semibold text-foreground text-right cursor-pointer hover:text-primary transition-colors hover:underline"
                    onClick={() => {
                      if (publication.publisherid) {
                        window.location.hash = `#/publishers/${encodeURIComponent(publication.publisherid)}`;
                      }
                    }}
                  >
                    {cleanPublisherName(publication.publishername)}
                  </span>
                </div>
              ) : null}
              {publication.category && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none text-[10px] rounded-lg">
                  {publication.category}
                </Badge>
              )}
              {publication.publicationcomment && (
                <div className="pt-2 leading-relaxed text-text-secondary italic">
                  {cleanComment(publication.publicationcomment)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Scrollable Issues list */}
        <div className="lg:col-span-2 flex flex-col min-h-0 h-full">
          <Card className="border-border-subtle rounded-2xl flex-1 flex flex-col overflow-hidden bg-surface/30">
            <CardHeader className="py-4 border-b border-border-subtle shrink-0">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {t("publication.issues")}
                </span>
                <Badge variant="secondary" className="font-bold text-xs">
                  {issues.length} {issues.length > 1 ? t("publication.issues_plural", "issues") : t("publication.issue_singular", "issue")}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto min-h-0">
              {issues.length === 0 ? (
                <div className="text-center py-20 text-xs text-muted-foreground">
                  {t("publication.empty")}
                </div>
              ) : (
                <div className="space-y-8 pb-4 pr-2">
                  {displayedSections.map((section) => (
                    <div key={section.key || "__unranged"} className="space-y-3">
                      {section.title !== null && (
                        <div className="flex items-center gap-3">
                          <h3
                            className={cn(
                              "font-bold text-foreground text-base tracking-tight",
                              section.titleIsCode && "italic font-mono text-sm"
                            )}
                          >
                            {section.title}
                          </h3>
                          <div className="h-px bg-border-subtle flex-1" />
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            {section.issues.length}{" "}
                            {section.issues.length > 1 ? t("publication.issues_plural", "issues") : t("publication.issue_singular", "issue")}
                          </span>
                        </div>
                      )}
                      {(section.circulation || section.comment) && (
                        <p className="text-[11px] text-muted-foreground italic -mt-1">
                          {section.circulation && `${t("publication.circulation")}: ${section.circulation}`}
                          {section.circulation && section.comment && " — "}
                          {section.comment && cleanComment(section.comment)}
                        </p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                        {section.issues.map((issue: any) => {
                          let preciseDate = "";
                          if (issue.oldestdate && issue.oldestdate.length >= 10 && issue.oldestdate !== "0000-00-00" && issue.oldestdate !== "9999-99-99") {
                            const parts = issue.oldestdate.split("-");
                            if (parts[1] !== "00") {
                              preciseDate = `${parts[2] !== "00" ? parts[2] + "/" : ""}${parts[1]}`;
                            }
                          }
                          // Inside a range the ISV files keep the range prefix
                          // in `issuenumber`; Inducks strips it before display.
                          const label = issueDisplayNumber(issue.issuecode, issue.issuerangecode, issue.issuenumber);
                          return (
                            <button
                              key={issue.issuecode}
                              onClick={() => onSelectIssue(issue.issuecode)}
                              className="p-2 border border-border-subtle rounded-xl bg-surface hover:bg-surface-2 hover:border-primary/50 transition-colors flex flex-col items-center justify-center text-center gap-1 group"
                              title={issue.issue_title ? `${label} - ${issue.issue_title}` : label}
                            >
                              <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                {label}
                              </span>
                              {preciseDate && (
                                <span className="text-[10px] text-muted-foreground">{preciseDate}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {sections.length > visibleSections && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={() => setVisibleSections(prev => prev + 5)}
                        variant="outline"
                        className="rounded-xl border-border-subtle hover:bg-surface-2 font-medium px-6"
                      >
                        {groupedByRange ? t("publication.show_more_sections") : t("publication.show_more_years")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
