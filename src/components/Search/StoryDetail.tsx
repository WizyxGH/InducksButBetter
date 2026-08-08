import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Copy, Check, Calendar, FileText, ChevronDown, ChevronUp, AlignJustify, Users, Link } from "lucide-react"
import { getStoryDetail } from "@/lib/dataService"
import { Button } from "@/components/ui/button"
import { DetailBackButton, DetailLoading, DetailNotFound } from "@/components/Layout/DetailPage"
import { Tag } from "@/components/ui/tag"
import { Card, CardContent } from "@/components/ui/card"
import { getFlagUrl, hasInducksCookie, isInvalidPlotsummary, formatInducksDate } from "@/lib/utils"
import { toast } from "sonner"
import { describeQueryError, QUERY_ERROR_TOAST_ID } from "@/lib/queryError"
import { EntityBadge } from "@/components/EntityBadge"
import { KindBadge } from "@/components/KindBadge"
import { useMetadata } from "@/hooks/useMetadata"
import { navigate } from "@/lib/navigation";
import { formatStoryPages } from "@/lib/storyPages";
import { routes } from "@/lib/routes";
import { groupCreditsByRole } from "@/lib/credits";

interface StoryDetailProps {
  storycode: string
  onBack: () => void
  onSelectIssue?: (issuecode: string) => void
  onSelectCharacter?: (code: string, name: string) => void
}

export function StoryDetail({ storycode, onBack, onSelectIssue, onSelectCharacter }: StoryDetailProps) {
  const { t, i18n } = useTranslation()
  const { meta } = useMetadata()
  const [loading, setLoading] = useState(true)
  const [story, setStory] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const hasCookie = React.useMemo(() => hasInducksCookie(), [])

  // Accordion states
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({})
  const [showAllDescriptions, setShowAllDescriptions] = useState(false)

  // Filters for publications
  const [pubSortOrder, setPubSortOrder] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true)
      try {
        const details = await getStoryDetail(storycode, i18n.language)
        setStory(details)
      } catch (e) {
        console.error(e)
        toast.error(describeQueryError(e, t), { id: QUERY_ERROR_TOAST_ID })
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [storycode, i18n.language])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(storycode)
    setCopied(true)
    toast.success(t("story.code_copied"))
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <DetailLoading />
  }

  if (!story) {
    return <DetailNotFound message={t("story.not_found")} onBack={onBack} />
  }

  const formatDate = (dateStr: string) => {
    return formatInducksDate(dateStr, i18n.language);
  };

  // Group publications by country
  const publicationsByCountry: Record<string, any[]> = {}
  story.publications?.forEach((pub: any) => {
    const country = pub.countryname || pub.countrycode || "Other"
    if (!publicationsByCountry[country]) {
      publicationsByCountry[country] = []
    }
    publicationsByCountry[country].push(pub)
  })

  const toggleCountry = (country: string) => {
    setExpandedCountries((prev) => ({
      ...prev,
      [country]: !prev[country],
    }))
  }

  const defaultDesc =
    story.descriptions?.find((d: any) => d.languagecode === i18n.language) ||
    story.descriptions?.find((d: any) => d.languagecode === "en") ||
    story.descriptions?.[0] ||
    (story.plotsummary && !isInvalidPlotsummary(story.plotsummary) ? { languagecode: "original", desctext: story.plotsummary } : null)

  const otherDescriptions = story.descriptions?.filter((d: any) => d.languagecode !== defaultDesc?.languagecode) || []

  // One line per role (Script, Art, …), each listing every person once —
  // grouping by person used to print one "Art" line per artist.
  const roleGroups = groupCreditsByRole(story.creators)

  // Parsed, not tested: "0" whole pages is a truthy string, and hid the
  // fraction of a page that is the real length of one-panel gags.
  const storyPages = formatStoryPages(story)

  return (
    <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <DetailBackButton onClick={onBack} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left/Middle Content: Main Story Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              {(() => {
                const original = story.original_title;
                const translated = story.translated_title;
                let mainTitle = original || t("story.no_title");
                let subTitle = null;
                
                if (translated && translated !== 'Untitled' && translated.toLowerCase() !== 'sans titre') {
                  mainTitle = translated;
                  if (original && original !== 'Untitled' && original !== translated) {
                    subTitle = original;
                  }
                } else if (!original || original === 'Untitled') {
                  mainTitle = t("story.no_title");
                }

                return (
                  <div>
                    <div title={mainTitle}>{mainTitle}</div>
                    {subTitle && (
                      <div className="text-sm text-muted-foreground font-medium mt-1 font-normal" title={subTitle}>
                        {subTitle}
                      </div>
                    )}
                  </div>
                );
              })()}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              {/* series_title comes from a subseries name when one exists; only
                  then is there a subseries page to link to (a storyheader has none). */}
              {story.subseriescode ? (
                <span
                  onClick={() => navigate(routes.subseries(story.subseriescode))}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  {story.series_title}
                </span>
              ) : (
                <span className="font-semibold">{story.series_title}</span>
              )}
              {story.firstpublicationdate && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(story.firstpublicationdate)}
                  </span>
                </>
              )}
              <div className="flex items-center gap-1.5 ml-2">
                <KindBadge kind={story.kind || "s"} />
                {storyPages && (
                  <Tag color="surface" icon={<FileText className="w-3 h-3" />}>
                    {storyPages.label} {storyPages.isFraction ? t("story.page") : t("story.pages")}
                  </Tag>
                )}
                {story.rowsperpage > 0 && (
                  <Tag color="surface" icon={<AlignJustify className="w-3 h-3" />}>
                    {t('story.strips_per_page', { count: story.rowsperpage })}
                  </Tag>
                )}
              </div>
            </div>
          </div>

          {/* Copyable Story Code */}
          <div 
            className="flex items-center gap-3 p-3 bg-surface-2 border border-border-subtle rounded-2xl cursor-pointer hover:bg-surface-3 transition-all active:scale-[0.99] group/copy"
            onClick={copyToClipboard}
            title={t("common.copy_to_clipboard")}
          >
            <div className="space-y-0.5 flex-1">
              <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">{t("story.story_code")}</p>
              <p className="font-mono text-sm font-bold text-foreground">{storycode}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-9 w-9 group-hover/copy:bg-surface rounded-xl pointer-events-none">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-text-secondary" />}
            </Button>
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t('story.description')}
            </h3>
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-4">
                {defaultDesc ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] capitalize font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {meta.languages.find((l) => l.languagecode === defaultDesc.languagecode)?.languagename || defaultDesc.languagecode.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-text-body leading-relaxed whitespace-pre-wrap">{defaultDesc.desctext}</p>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary italic">{t("story.no_description")}</p>
                )}

                {/* Accordion for descriptions in other languages */}
                {otherDescriptions.length > 0 && (
                  <div className="pt-2 border-t border-border-subtle">
                    <button
                      onClick={() => setShowAllDescriptions(!showAllDescriptions)}
                      className="flex items-center justify-between w-full text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                    >
                      <span>
                        {showAllDescriptions
                          ? t("story.hide_languages")
                          : `${t("story.show_languages")} (${otherDescriptions.length})`}
                      </span>
                      {showAllDescriptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showAllDescriptions && (
                      <div className="mt-4 space-y-4 animate-fadeIn">
                        {otherDescriptions.map((desc: any) => {
                          const langName = meta.languages.find((l) => l.languagecode === desc.languagecode)?.languagename || desc.languagecode.toUpperCase();
                          return (
                            <div key={desc.languagecode} className="space-y-1 pt-3 border-t border-border-subtle/50 first:border-none first:pt-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] capitalize font-bold bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded">
                                  {langName}
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{desc.desctext}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Creators Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {t("story.creators")}
            </h3>
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
              <CardContent className="p-4 space-y-3">
                {roleGroups.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {roleGroups.map((group) => (
                      <div key={group.role} className="flex flex-col gap-1 items-start">
                        <span className="text-[10px] font-bold text-text-secondary tracking-wider">
                          {t(`story.${group.role}`)}
                        </span>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-2 items-center">
                          {group.people.map((person, i) => (
                            <React.Fragment key={person.code}>
                              <EntityBadge
                                type="creator"
                                code={person.code}
                                name={person.name}
                                onSelect={(code) => navigate(routes.author(code))}
                              />
                              {i < group.people.length - 1 && <span className="text-sm text-text-secondary -ml-1">,</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary italic">Non crédité.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Content: Cover / Characters / Publications */}
        <div className="space-y-6">
          {/* Story Thumbnail (if available) */}
          {hasCookie && story.story_thumb && (
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm overflow-hidden">
              <div className="aspect-[4/3] w-full flex items-center justify-center p-2 bg-zinc-50 dark:bg-zinc-800">
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(
                    story.story_thumb.split("|")[1] || story.story_thumb
                  )}`}
                  alt=""
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              </div>
            </Card>
          )}

          {/* Characters Panel */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">{t("story.characters")}</h3>
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
              <CardContent className="p-4">
                {story.characters && story.characters.length > 0 ? (
                  <div className="flex flex-wrap gap-x-2.5 gap-y-2 p-1 items-center">
                    {story.characters.map((c: any, i: number) => (
                      <React.Fragment key={`${c.charactercode}-${i}`}>
                        <EntityBadge
                          type="character"
                          code={c.charactercode}
                          name={c.charactername || c.charactercode}
                          charComment={c.charactercomment}
                          appComment={c.appearancecomment}
                          onSelect={onSelectCharacter}
                        />
                        {i < story.characters.length - 1 && <span className="text-sm text-text-secondary -ml-1">,</span>}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary italic">{t("story.no_characters")}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cross References Section */}
          {story.xrefs && story.xrefs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Link className="w-4 h-4 text-primary" />
                {t("story.xrefs")}
              </h3>
              <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col gap-3">
                    {Object.entries(
                      story.xrefs.reduce((acc: any, xref: any) => {
                        const reason = xref.reasontranslation || xref.reasontext || xref.referencereasonid;
                        if (!acc[reason]) acc[reason] = [];
                        acc[reason].push(xref);
                        return acc;
                      }, {})
                    ).map(([reason, refs]: [string, any], idx: number) => (
                      <div key={idx} className="flex flex-col gap-1 items-start">
                        <span className="text-[10px] font-bold text-text-secondary tracking-wider">
                          {reason}
                        </span>
                        <div className="flex flex-wrap gap-x-3 gap-y-2">
                          {refs.map((xref: any, refIdx: number) => (
                            <div key={refIdx} className="flex items-center">
                              <span
                                onClick={() => {
                                  navigate(`${routes.story(xref.targetcode)}`);
                                }}
                                className="flex items-center gap-1.5 hover:bg-surface-2 p-1 -m-1 rounded-md transition-colors cursor-pointer text-xs font-medium text-primary"
                              >
                                {xref.title ? (
                                  <>
                                    {xref.title} <span className="text-xs text-text-secondary font-normal ml-1">({xref.targetcode})</span>
                                  </>
                                ) : (
                                  xref.targetcode
                                )}
                              </span>
                              {refIdx < refs.length - 1 && <span className="text-sm text-text-secondary ml-1.5">,</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Publications by Country (Full Width) */}
      <div className="space-y-3 pt-6 border-t border-border-subtle mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            {t("tabs.publications")}
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
              {story.publications?.length || 0}
            </span>
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPubSortOrder(pubSortOrder === "asc" ? "desc" : "asc")}
            className="h-8 rounded-xl text-xs font-medium bg-surface hover:bg-surface-2 gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            {pubSortOrder === "asc" ? t("sort.oldest_first") : t("sort.newest_first")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(publicationsByCountry).map((country) => {
            let pubs = [...publicationsByCountry[country]].sort((a, b) => {
              const dateA = a.oldestdate || "9999-99-99";
              const dateB = b.oldestdate || "9999-99-99";
              return pubSortOrder === "asc" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
            });
            const flagCode = pubs[0]?.countrycode || "un"
            const isExpanded = !!expandedCountries[country]
            return (
              <div
                key={country}
                className="border border-border-subtle bg-surface rounded-2xl overflow-hidden transition-all shadow-xs h-fit"
              >
                <button
                  onClick={() => toggleCountry(country)}
                  className="w-full flex items-center justify-between p-3 px-4 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={getFlagUrl(flagCode)}
                      className="w-4 h-3 rounded-xs shrink-0 object-cover"
                      alt=""
                    />
                    <span className="text-xs font-bold text-text-body">{country}</span>
                    <span className="text-[10px] bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded-md font-bold font-mono">
                      {pubs.length}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border-subtle bg-surface-2/30 p-2 space-y-1.5 animate-fadeIn">
                    {pubs.map((pub: any, i: number) => (
                      <div
                        key={pub.entrycode + i}
                        onClick={() => {
                          if (pub.position) {
                            navigate(`${routes.issue(pub.issuecode, pub.publicationcode)}?pos=${encodeURIComponent(pub.position.trim().toLowerCase())}`);
                          } else if (onSelectIssue) {
                            onSelectIssue(pub.issuecode);
                          }
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer border border-transparent hover:border-border-subtle"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">
                            {pub.publication_title} {t("story.issue_symbol")} {pub.issuenumber}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {pub.position ? `Pos. ${pub.position}` : ""}
                            {pub.entry_title && <span className="italic ml-1">{pub.position ? `- ${pub.entry_title}` : pub.entry_title}</span>}
                          </p>
                        </div>
                        {/* No page badge here: the length belongs to the story
                            version, so it is the same for every printing and
                            already shown in the header. */}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
