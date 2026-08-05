import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, BookOpen, Calendar, DollarSign, Ruler, Layers, Link as LinkIcon, Loader2, ChevronDown, ChevronUp , UserCheck} from "lucide-react"
import { getIssueDetail } from "@/lib/dataService"
import { Button } from "@/components/ui/button"
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton"
import { Card, CardContent } from "@/components/ui/card"
import { getFlagUrl, formatInducksDate } from "@/lib/utils"
import { toast } from "sonner"
import { KindBadge } from "@/components/KindBadge"
import { Link } from "@/components/ui/link"
import { routes } from "@/lib/routes"
import { isModifiedClick } from "@/lib/navigation"

interface IssueDetailProps {
  issuecode: string
  onBack: () => void
  onSelectStory?: (storycode: string) => void
}

interface StoryEntryCardProps {
  storycode?: string
  anchorId?: string
  onSelectStory?: (storycode: string) => void
  children: React.ReactNode
}

/**
 * One entry of an issue's table of contents.
 *
 * Rendered as a real anchor so ctrl/cmd/middle-click opens the story in a new
 * tab. A plain click is handled in-app, and `preventDefault` there is what
 * stops the click from *also* pushing a history entry through `<Link>` — the
 * duplicate push is what previously made the entry look like it needed two
 * clicks and left the back button one step behind.
 */
function StoryEntryCard({ storycode, anchorId, onSelectStory, children }: StoryEntryCardProps) {
  const className =
    "group block rounded-2xl border-border-subtle bg-surface hover:bg-surface-2 transition-all shadow-xs border text-left hover:border-primary/20"

  if (!storycode) {
    return <div id={anchorId} className={className}>{children}</div>
  }

  return (
    <Link
      id={anchorId}
      to={routes.story(storycode)}
      className={`${className} cursor-pointer`}
      onClick={(e) => {
        if (isModifiedClick(e)) return
        if (onSelectStory) {
          e.preventDefault()
          onSelectStory(storycode)
        }
      }}
    >
      {children}
    </Link>
  )
}

export function IssueDetail({ issuecode, onBack, onSelectStory }: IssueDetailProps) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<any>(null)
  const [isContentExpanded, setIsContentExpanded] = useState(true)
  const hasCookie = useMemo(() => !!localStorage.getItem("inducks_cookie"), [])

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true)
      try {
        const details = await getIssueDetail(issuecode)
        setIssue(details)
      } catch (e) {
        console.error(e)
        toast.error(t("publication.error_load"))
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [issuecode])

  useEffect(() => {
    if (!loading && issue) {
      const hash = window.location.hash;
      const match = hash.match(/[?&]pos=([^&]+)/i);
      if (match) {
        const pos = decodeURIComponent(match[1]).trim().toLowerCase();
        setTimeout(() => {
          const element = document.getElementById(`pos-${pos}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("highlight-pulse");
            setTimeout(() => {
              element.classList.remove("highlight-pulse");
            }, 2000);
          }
        }, 500);
      }
    }
  }, [loading, issue, window.location.hash]);

  // Build high-res cover image URL
  const coverUrl = useMemo(() => {
    if (!issue?.issue_thumb) return null
    const parts = issue.issue_thumb.split("|")
    const url = parts.length > 1 ? parts[1] : parts[0]
    let baseUrl = url
    if (!url.startsWith("http")) {
      if (parts[0] === "webusers" && !url.startsWith("webusers/")) {
        baseUrl = `https://outducks.org/webusers/webusers/${url}`
      } else {
        baseUrl = `https://outducks.org/${url.startsWith("/") ? url.substring(1) : url}`
      }
    }
    return `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=${baseUrl}`)}`
  }, [issue?.issue_thumb])

  if (loading) {
    return <PageLoadingSkeleton />
  }

  if (!issue) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{t("publication.empty")}</p>
        <Button onClick={onBack} variant="outline" className="mt-4 gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </Button>
      </div>
    )
  }

  // Inducks stores partial dates (YYYY-00-00, quarters, decades, a trailing
  // '?'), so formatting goes through the shared Inducks-aware formatter
  // instead of a local Intl call that would mangle them.
  const formatDate = (dateStr: string) =>
    !dateStr || dateStr === "0000-00-00" ? t("story.unknown_date") : formatInducksDate(dateStr, i18n.language)


  return (
    <div className="w-full max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="outline" size="sm" className="rounded-xl gap-1.5 h-9">
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Cover & Core Specs */}
        <div className="space-y-6">
          {hasCookie && (
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm overflow-hidden p-2">
              <div className="aspect-[3/4] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 rounded-lg overflow-hidden">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain hover:scale-102 transition-transform duration-500"
                  />
                ) : (
                  <BookOpen className="w-12 h-12 text-muted-foreground opacity-20" />
                )}
              </div>
            </Card>
          )}

          {/* Issue Specs */}
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                {t("publication.issue_no")}
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-text-body">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="font-bold">{t("publication.date")}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(issue.oldestdate)}</p>
                  </div>
                </div>

                {issue.pages && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <Layers className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">{t("publication.pages")}</p>
                      <p className="text-[10px] text-muted-foreground">{issue.pages} {t("search.pages").toLowerCase()}</p>
                    </div>
                  </div>
                )}

                {issue.indexers?.length > 0 && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <UserCheck className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold">{t("issue.indexed_by")}</p>
                      <p className="text-[10px] text-muted-foreground flex flex-wrap gap-x-1.5">
                        {issue.indexers.map((p: any) => (
                          <Link key={p.personcode} to={routes.author(p.personcode)} className="hover:text-primary hover:underline">
                            {p.fullname}
                          </Link>
                        ))}
                      </p>
                    </div>
                  </div>
                )}

                {issue.price && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <DollarSign className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">{t("search.price")}</p>
                      <p className="text-[10px] text-muted-foreground">{issue.price}</p>
                    </div>
                  </div>
                )}

                {issue.size && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <Ruler className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">{t("search.dimensions")}</p>
                      <p className="text-[10px] text-muted-foreground">{issue.size}</p>
                    </div>
                  </div>
                )}

                {issue.attached && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">{t("search.attached")}</p>
                      <p className="text-[10px] text-muted-foreground">{issue.attached}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Title, Index of stories */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <img
                src={getFlagUrl(issue.countrycode)}
                className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                alt=""
              />
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {issue.countryname}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {issue.publication_title} #{issue.issuenumber}
            </h1>
            <p className="text-xs font-semibold text-text-secondary">{t("common.code")} : {issuecode}</p>
          </div>

          {/* Index of Stories */}
          <div className="space-y-3">
            <button 
              onClick={() => setIsContentExpanded(!isContentExpanded)} 
              className="flex items-center justify-between w-full group"
            >
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                {t("publication.content")} 
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                  {t("publication.entry", { count: issue.stories?.length || 0 })}
                </span>
              </h3>
              <div className="p-1 rounded-md hover:bg-surface-2 transition-colors">
                {isContentExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                )}
              </div>
            </button>
            
            {isContentExpanded && (
              <div className="space-y-3 pt-1">
                {issue.stories && issue.stories.length > 0 ? (
                  issue.stories.map((story: any, idx: number) => (
                    <StoryEntryCard
                      // Include idx to guarantee uniqueness: the same storycode can
                      // appear multiple times in a single issue (e.g. multi-part stories).
                      key={`${story.storycode ?? ""}-${idx}`}
                      storycode={story.storycode}
                      anchorId={story.position ? `pos-${story.position.trim().toLowerCase()}` : undefined}
                      onSelectStory={onSelectStory}
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        {/* Position / Index badge */}
                        <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-surface-2 text-[10px] font-bold font-mono text-text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
                          {story.position || idx + 1}
                        </span>
                        
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {(() => {
                                const title = story.entry_title || story.original_title;
                                return (!title || title === 'Untitled') 
                                  ? t("story.no_title") 
                                  : title;
                              })()}
                            </p>
                            {story.entirepages && (
                              <span className="text-[10px] bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded font-bold font-mono shrink-0">
                                {story.entirepages} {t("story.pages_short")}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 overflow-hidden">
                            {story.kind && (
                              <KindBadge kind={story.kind} />
                            )}
                            {story.original_title && story.original_title !== story.entry_title && (
                              <p className="text-[10px] text-muted-foreground italic truncate">
                                {t("story.original_title")} : {story.original_title}
                              </p>
                            )}
                          </div>

                          {/* Credits */}
                          {(story.writers || story.artists) && (
                            <div className="text-[10px] text-text-secondary space-y-0.5">
                              {story.writers && (
                                <p className="truncate">
                                  <span className="font-semibold">{t("story.script")} :</span> {story.writers}
                                </p>
                              )}
                              {story.artists && (
                                <p className="truncate">
                                  <span className="font-semibold">{t("story.art")} :</span> {story.artists}
                                </p>
                              )}
                            </div>
                          )}

                          {story.storycode && (
                            <p className="text-[9px] font-mono font-bold text-primary truncate pt-1">
                              {story.storycode}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </StoryEntryCard>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary italic">{t("publication.empty")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
