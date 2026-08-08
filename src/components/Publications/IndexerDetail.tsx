import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Globe, Loader2, UserCheck } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DetailBackButton, DetailLoading } from "@/components/Layout/DetailPage";
import { Link } from "@/components/ui/link";
import { routes } from "@/lib/routes";
import { getFlagUrl, formatInducksDate } from "@/lib/utils";
import { isModifiedClick } from "@/lib/navigation";
import { splitIssueCode } from "@/lib/issueCode";

interface IndexerDetailProps {
  personcode: string;
  onBack: () => void;
  onSelectIssue?: (issuecode: string) => void;
}

/** How many indexed issues are shown per "load more" step. */
const ISSUES_PER_PAGE = 30;

/**
 * Profile of someone who catalogues issues for Inducks.
 *
 * This is deliberately not the author page: an indexer documents *printings*,
 * so the page reports issues catalogued and countries covered rather than
 * stories written or drawn.
 */
export function IndexerDetail({ personcode, onBack, onSelectIssue }: IndexerDetailProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<any>(null);
  const [stats, setStats] = useState<{ issues: number; countries: number; first: string; last: string } | null>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPage(1);

    const load = async () => {
      setLoading(true);
      try {
        const [personRes, statsRes, countriesRes, issuesRes] = await Promise.all([
          executeQuery({
            sql: `SELECT personcode, fullname, nationalitycountrycode FROM inducks_person WHERE personcode = ?`,
            args: [personcode],
          }),
          executeQuery({
            sql: `
              SELECT COUNT(DISTINCT ij.issuecode) AS issues,
                     COUNT(DISTINCT p.countrycode) AS countries,
                     MIN(NULLIF(i.oldestdate, '')) AS first,
                     MAX(NULLIF(i.oldestdate, '')) AS last
              FROM inducks_issuejob ij
              JOIN inducks_issue i ON ij.issuecode = i.issuecode
              LEFT JOIN inducks_publication p ON i.publicationcode = p.publicationcode
              WHERE ij.personcode = ? AND ij.inxtransletcol = 'i'
            `,
            args: [personcode],
          }),
          executeQuery({
            sql: `
              SELECT p.countrycode, COUNT(DISTINCT ij.issuecode) AS total
              FROM inducks_issuejob ij
              JOIN inducks_issue i ON ij.issuecode = i.issuecode
              JOIN inducks_publication p ON i.publicationcode = p.publicationcode
              WHERE ij.personcode = ? AND ij.inxtransletcol = 'i'
              GROUP BY p.countrycode
              ORDER BY total DESC
              LIMIT 12
            `,
            args: [personcode],
          }),
          executeQuery({
            sql: ISSUES_SQL,
            args: [personcode, ISSUES_PER_PAGE, 0],
          }),
        ]);

        if (cancelled) return;
        // `null` marks "no such indexer" so the page can say so, instead of
        // rendering the code as a name above a row of zeroes.
        setPerson(personRes.rows[0] ?? null);
        setStats((statsRes.rows[0] as any) ?? null);
        setCountries(countriesRes.rows);
        setIssues(issuesRes.rows);
      } catch (err) {
        console.error("Failed to load indexer:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [personcode, i18n.language]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await executeQuery({
        sql: ISSUES_SQL,
        args: [personcode, ISSUES_PER_PAGE, page * ISSUES_PER_PAGE],
      });
      setIssues((prev) => [...prev, ...res.rows]);
      setPage((p) => p + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <DetailLoading />;

  const total = Number(stats?.issues ?? 0);

  // An unknown code, or a person who never indexed anything, is not a profile.
  if (!person || total === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto p-8 space-y-4 text-center">
        <UserCheck className="w-12 h-12 text-text-secondary mx-auto opacity-40" />
        <h1 className="text-lg font-semibold text-foreground">{t("indexer.not_found_title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("indexer.not_found_desc", { code: personcode })}
        </p>
        <DetailBackButton onClick={onBack} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
      <DetailBackButton onClick={onBack} />

      <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{person?.fullname || personcode}</h1>
              <p className="text-xs text-muted-foreground">{t("indexer.role")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-bold text-text-secondary">{t("indexer.issues_indexed")}</p>
              <p className="text-lg font-semibold text-foreground">{total.toLocaleString()}</p>
            </div>
            <div>
              <p className="font-bold text-text-secondary">{t("indexer.countries_covered")}</p>
              <p className="text-lg font-semibold text-foreground">{Number(stats?.countries ?? 0)}</p>
            </div>
            {stats?.first && (
              <div>
                <p className="font-bold text-text-secondary">{t("indexer.period")}</p>
                <p className="text-sm text-muted-foreground">
                  {formatInducksDate(stats.first, i18n.language)} – {formatInducksDate(stats.last, i18n.language)}
                </p>
              </div>
            )}
          </div>

          {countries.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle">
              {countries.map((c: any) => (
                <Link
                  key={c.countrycode}
                  to={routes.country(c.countrycode)}
                  className="flex items-center gap-1.5 text-[11px] bg-surface-2 border border-border-subtle rounded-lg px-2 py-1 hover:border-primary/30"
                >
                  <img src={getFlagUrl(c.countrycode)} alt="" className="w-4 h-3 rounded-xs object-cover" />
                  <span className="uppercase font-medium">{c.countrycode}</span>
                  <span className="text-muted-foreground">{Number(c.total).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
        <CardContent className="p-6 space-y-3">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {t("indexer.indexed_issues")}
          </h2>

          {issues.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("common.no_data")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {issues.map((issue: any) => (
                <Link
                  key={issue.issuecode}
                  to={routes.issue(issue.issuecode, issue.publicationcode)}
                  onClick={(e) => {
                    if (isModifiedClick(e)) return;
                    if (onSelectIssue) {
                      e.preventDefault();
                      onSelectIssue(issue.issuecode);
                    }
                  }}
                  className="p-3 rounded-xl bg-surface-2/30 border border-border-subtle hover:bg-surface-2 hover:border-primary/20 transition-all flex items-center gap-2 min-w-0"
                >
                  <img src={getFlagUrl(issue.countrycode)} alt="" className="w-4 h-3 rounded-xs object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {issue.publicationname || issue.publicationcode}{" "}
                      <span className="text-muted-foreground">#{splitIssueCode(issue.issuecode, issue.publicationcode).issuenumber}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatInducksDate(issue.oldestdate, i18n.language)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {issues.length < total && (
            <Button variant="outline" className="w-full rounded-xl h-9" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("common.load_more")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** One page of issues this person indexed. Bound: personcode, limit, offset. */
const ISSUES_SQL = `
  SELECT i.issuecode, i.publicationcode, i.oldestdate, p.countrycode,
         (SELECT pn.publicationname FROM inducks_publicationname pn
          WHERE pn.publicationcode = p.publicationcode LIMIT 1) AS publicationname
  FROM inducks_issuejob ij
  JOIN inducks_issue i ON ij.issuecode = i.issuecode
  LEFT JOIN inducks_publication p ON i.publicationcode = p.publicationcode
  WHERE ij.personcode = ? AND ij.inxtransletcol = 'i'
  ORDER BY COALESCE(NULLIF(i.oldestdate, ''), '0000') DESC, i.issuecode ASC
  LIMIT ? OFFSET ?
`;

export default IndexerDetail;
