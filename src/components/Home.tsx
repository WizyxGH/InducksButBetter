import * as React from "react"
import { useTranslation } from "react-i18next"
import { BookOpen, LibraryBig, User, Cat, Database, ArrowRight } from "lucide-react"
import { routes } from "@/lib/routes"
import { executeQuery } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { UnifiedSearchBar } from "./Search/UnifiedSearchBar"
import { Skeleton } from "@/components/ui/skeleton"
import { navigate } from "@/lib/navigation";
import { Link } from "@/components/ui/link";

interface DBStats {
  storiesCount: number
  issuesCount: number
  personsCount: number
  charactersCount: number
  publicationsCount: number
}

export function Home() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = React.useState(true)
  const [dbAvailable, setDbAvailable] = React.useState(false)
  const [stats, setStats] = React.useState<DBStats | null>(null)
  const [latestReleases, setLatestReleases] = React.useState<any[]>([])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get database statistics
      const statsRes = await executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM inducks_story) as stories_count,
          (SELECT COUNT(*) FROM inducks_issue) as issues_count,
          (SELECT COUNT(*) FROM inducks_person) as persons_count,
          (SELECT COUNT(*) FROM inducks_character) as characters_count,
          (SELECT COUNT(*) FROM inducks_publication) as publications_count
      `)

      const statsRow = statsRes.rows[0]
      const fetchedStats: DBStats = {
        storiesCount: Number(statsRow.stories_count || 0),
        issuesCount: Number(statsRow.issues_count || 0),
        personsCount: Number(statsRow.persons_count || 0),
        charactersCount: Number(statsRow.characters_count || 0),
        publicationsCount: Number(statsRow.publications_count || 0),
      }
      setStats(fetchedStats)

      // 3. Get latest magazine releases from the past 7 calendar days (all countries)
      const releasesRes = await executeQuery(`
        SELECT 
          i.issuecode, 
          i.issuenumber, 
          i.title as issue_title, 
          i.pages, 
          i.oldestdate,
          p.publicationcode, 
          p.countrycode, 
          p.languagecode, 
          COALESCE(pn.publicationname, p.title) as series_title
        FROM inducks_issue i
        JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        LEFT JOIN inducks_publicationname pn ON i.publicationcode = pn.publicationcode
        WHERE i.oldestdate IS NOT NULL 
          AND i.oldestdate != '0000-00-00' 
          AND i.oldestdate != '9999-99-99'
          AND i.oldestdate >= date('now', '-7 days')
          AND i.oldestdate <= date('now', '+1 day')
        ORDER BY i.oldestdate DESC,
          CASE WHEN p.languagecode = '${i18n.language === 'en' ? 'en' : (i18n.language || 'fr')}' THEN 0 ELSE 1 END ASC
        LIMIT 48
      `)
      setLatestReleases(releasesRes.rows || [])
      setDbAvailable(true)
    } catch (err) {
      console.warn("Local/remote database not fully available:", err)
      setDbAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [i18n.language])

  React.useEffect(() => {
    fetchData()

    // Listen to local database loads to automatically refresh stats/releases
    window.addEventListener("db-local-loaded", fetchData)
    return () => {
      window.removeEventListener("db-local-loaded", fetchData)
    }
  }, [fetchData])

  const goToSettings = () => {
    navigate("#/settings")
  }

  // Fallback view when no database (local or remote) is loaded/accessible
  if (!loading && !dbAvailable) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12 max-w-xl mx-auto text-center gap-6">
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full">
          <Database className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("localDb.title", "Base de données non disponible")}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("home.db_missing", "Veuillez charger une base de données locale dans les Paramètres pour afficher les statistiques et les publications.")}
          </p>
        </div>
        <Button onClick={goToSettings} className="rounded-xl flex gap-2 items-center font-medium">
          {t("settings.title", "Paramètres")}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background/50">
      {/* Hero Header */}
      <section className="relative px-4 lg:px-12 py-12 flex flex-col items-center justify-center text-center gap-6 border-b border-border-subtle bg-gradient-to-b from-surface/30 to-background/10">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            {t("home.title", "InducksButBetter")}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t("home.subtitle", "Explorez la base de données Inducks")}
          </p>

          {loading ? (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5 opacity-50">
                  <Skeleton className="w-3.5 h-3.5 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground mt-4">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{stats.storiesCount.toLocaleString()}</span>
                {t("home.type_story", { count: stats.storiesCount })}
              </span>
              <span className="flex items-center gap-1.5">
                <LibraryBig className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{stats.issuesCount.toLocaleString()}</span>
                {t("home.type_issue", { count: stats.issuesCount })}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{stats.publicationsCount.toLocaleString()}</span>
                {t("home.type_publication", { count: stats.publicationsCount })}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{stats.personsCount.toLocaleString()}</span>
                {t("home.type_author", { count: stats.personsCount })}
              </span>
              <span className="flex items-center gap-1.5">
                <Cat className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{stats.charactersCount.toLocaleString()}</span>
                {t("home.type_character", { count: stats.charactersCount })}
              </span>
            </div>
          ) : null}
        </div>

        {/* Unified Search Input */}
        <div className="w-full mt-4 flex flex-col items-center">
          <UnifiedSearchBar />
        </div>
      </section>

      {/* Main Grid Dashboard */}
      <main className="px-4 lg:px-12 py-10 space-y-10 max-w-7xl mx-auto">
        {/* Loading skeleton */}
        {loading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* Latest releases — compact cards */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <LibraryBig className="w-4.5 h-4.5 text-primary" />
                {t("home.latest_releases_title", "Dernières sorties")}
              </h3>
              {latestReleases.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4">
                  {t("home.no_releases", "Aucune sortie enregistrée dans les 7 derniers jours.")}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {latestReleases.map((row) => {
                    const targetHref = routes.issue(row.issuecode);
                    const cleanTitle = row.series_title
                      ? row.series_title.replace(/^\[|\]$/g, '').replace(/\[.*?\]/g, '').trim()
                      : '';
                    return (
                      <Link key={row.issuecode}
                        to={targetHref}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-surface hover:bg-surface-2 hover:border-primary/30 transition-all duration-200 group"
                      >
                        <div className="w-6 h-4 shrink-0 rounded-sm overflow-hidden border border-border-subtle/50 shadow-sm flex items-center justify-center bg-surface-2">
                          <img
                            src={`https://flagicons.lipis.dev/flags/4x3/${row.countrycode?.toLowerCase()}.svg`}
                            className="w-full h-full object-cover"
                            alt={row.countrycode}
                            loading="lazy"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {cleanTitle} <span className="text-muted-foreground font-normal">#{row.issuenumber}</span>
                          </p>
                          {row.oldestdate && (
                            <p className="text-[10px] text-muted-foreground">{row.oldestdate}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// Maintainable Skeleton Loading State
function HomeSkeleton() {
  return (
    <div className="w-full space-y-10">
      {/* Latest Releases Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4.5 h-4.5 rounded-sm" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-surface"
            >
              <Skeleton className="w-6 h-4 rounded-sm shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
