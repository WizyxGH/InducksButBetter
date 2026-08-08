import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { BookOpen, Calendar, Globe, Layers, ListOrdered } from "lucide-react"
import { getSubseriesDetail } from "@/lib/dataService"
import { pickSubseriesName, listSubseriesNames } from "@/lib/subseries"
import { useMetadata } from "@/hooks/useMetadata"
import { DetailBackButton, DetailLoading, DetailNotFound } from "@/components/Layout/DetailPage"
import { Card, CardContent } from "@/components/ui/card"
import { KindBadge } from "@/components/KindBadge"
import { Link } from "@/components/ui/link"
import { routes } from "@/lib/routes"
import { isModifiedClick } from "@/lib/navigation"
import { cleanComment, formatInducksDate, hasInducksCookie } from "@/lib/utils"
import { thumbUrl } from "@/components/ResultCard/thumbUrl"
import { formatStoryPages } from "@/lib/storyPages"
import { toast } from "sonner"
import { describeQueryError, QUERY_ERROR_TOAST_ID } from "@/lib/queryError"

interface SubseriesDetailProps {
  subseriescode: string
  onBack: () => void
  onSelectStory?: (storycode: string) => void
}

export function SubseriesDetail({ subseriescode, onBack, onSelectStory }: SubseriesDetailProps) {
  const { t, i18n } = useTranslation()
  const { meta } = useMetadata()
  const [loading, setLoading] = useState(true)
  const [subseries, setSubseries] = useState<any>(null)
  const hasCookie = useMemo(() => hasInducksCookie(), [])

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true)
      try {
        const details = await getSubseriesDetail(subseriescode, i18n.language)
        setSubseries(details)
      } catch (e) {
        console.error(e)
        toast.error(describeQueryError(e, t), { id: QUERY_ERROR_TOAST_ID })
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [subseriescode, i18n.language])

  if (loading) {
    return <DetailLoading />
  }

  if (!subseries) {
    return <DetailNotFound message={t("subseries.not_found")} onBack={onBack} />
  }

  const displayName = pickSubseriesName(subseries.names, i18n.language, subseries.subseriesname)
  const comment = subseries.subseriescomment ? cleanComment(subseries.subseriescomment) : ""
  const stories: any[] = subseries.stories || []
  // One name per language, minus the one already used as the page title.
  const otherNames = listSubseriesNames(subseries.names).filter(
    (n) => n.subseriesname !== displayName
  )
  const languageName = (code: string) =>
    meta.languages.find((l) => l.languagecode === code)?.languagename || code.toUpperCase()

  return (
    <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <DetailBackButton onClick={onBack} />
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">{displayName}</h1>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
          <span className="font-mono text-xs font-semibold">{subseries.subseriescode}</span>
          {subseries.subseriescategory && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {subseries.subseriescategory}
            </span>
          )}
          {subseries.official === "N" && (
            <span className="text-[10px] font-bold bg-surface-2 text-text-secondary px-2 py-0.5 rounded-full italic">
              {t("subseries.maybe_error")}
            </span>
          )}
        </div>
        {displayName !== subseries.subseriesname && (
          <p className="text-xs text-muted-foreground italic">{subseries.subseriesname}</p>
        )}
        {comment && (
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-text-body leading-relaxed whitespace-pre-wrap">{comment}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Names in the other languages, like the reference subseries page. */}
      {otherNames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            {t("subseries.other_names")}
          </h3>
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
            <CardContent className="p-4">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {otherNames.map((name) => (
                  <li key={name.languagecode} className="flex items-baseline gap-2 text-sm min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide shrink-0 capitalize">
                      {languageName(name.languagecode)}
                    </span>
                    <span className="text-text-body truncate" title={name.subseriesname}>
                      {name.subseriesname}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Story index */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-primary" />
          {t("subseries.stories")}
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
            {stories.length}
          </span>
        </h3>

        {stories.length === 0 ? (
          <p className="text-sm text-text-secondary italic">{t("subseries.no_stories")}</p>
        ) : (
          <div className="space-y-2">
            {stories.map((story, idx) => {
              const thumb = hasCookie ? thumbUrl(story.story_thumb) : null
              return (
                <Link
                  key={`${story.storycode}-${idx}`}
                  to={routes.story(story.storycode)}
                  className="group flex items-center gap-4 p-3 rounded-2xl border border-border-subtle bg-surface hover:bg-surface-2 hover:border-primary/20 transition-all shadow-xs cursor-pointer"
                  onClick={(e) => {
                    if (isModifiedClick(e)) return
                    if (onSelectStory) {
                      e.preventDefault()
                      onSelectStory(story.storycode)
                    }
                  }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-14 h-14 rounded-lg object-cover bg-surface-2 shrink-0"
                      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-muted-foreground opacity-30" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {story.title || t("story.no_title")}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground font-semibold">{story.storycode}</p>
                    {story.storysubseriescomment && (
                      <p className="text-[10px] text-text-secondary italic truncate">
                        {cleanComment(story.storysubseriescomment)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                    <div className="flex items-center gap-1.5">
                      {story.kind && <KindBadge kind={story.kind} />}
                      {formatStoryPages(story) && (
                        <span className="text-[10px] bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded font-bold font-mono flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {formatStoryPages(story)!.label} {t("story.pages_short")}
                        </span>
                      )}
                    </div>
                    {story.firstpublicationdate && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatInducksDate(story.firstpublicationdate, i18n.language)}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
