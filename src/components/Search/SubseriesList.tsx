import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Layers, Search } from "lucide-react"
import { getSubseriesList } from "@/lib/dataService"
import { DetailLoading } from "@/components/Layout/DetailPage"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/components/ui/link"
import { routes } from "@/lib/routes"
import { isModifiedClick } from "@/lib/navigation"
import { matchesSubseriesQuery, groupSubseriesByCategory } from "@/lib/subseries"
import { toast } from "sonner"
import { describeQueryError, QUERY_ERROR_TOAST_ID } from "@/lib/queryError"

interface SubseriesListProps {
  onSelectSubseries?: (code: string) => void
}

/** Catalogue of every subseries, grouped by the Inducks category. */
export function SubseriesList({ onSelectSubseries }: SubseriesListProps) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    async function fetchList() {
      setLoading(true)
      try {
        setRows(await getSubseriesList(i18n.language))
      } catch (e) {
        console.error(e)
        toast.error(describeQueryError(e, t), { id: QUERY_ERROR_TOAST_ID })
      } finally {
        setLoading(false)
      }
    }
    fetchList()
  }, [i18n.language])

  // Filtering happens client-side: the whole catalogue is ~1 200 rows, and it
  // must match the name in any language, like the search filter does.
  const groups = useMemo(
    () => groupSubseriesByCategory(rows.filter((r) => matchesSubseriesQuery(r, query))),
    [rows, query]
  )
  const total = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups]
  )

  if (loading) return <DetailLoading />

  return (
    <div className="h-full overflow-y-auto bg-surface-2/20">
      <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            {t("subseries.list_title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("subseries.list_subtitle")}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("subseries.list_search")}
            className="pl-9 h-11 rounded-xl bg-surface"
          />
        </div>

        <p className="text-xs text-muted-foreground font-medium">
          {t("subseries.count", { count: total })}
        </p>

        {groups.length === 0 ? (
          <p className="text-sm text-text-secondary italic">{t("common.no_data")}</p>
        ) : (
          groups.map((group) => (
            <div key={group.category} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-foreground">
                  {group.category || t("subseries.uncategorized")}
                </h3>
                <div className="h-px bg-border-subtle flex-1" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {group.items.length}
                </span>
              </div>
              <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
                <CardContent className="p-2">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {group.items.map((item) => (
                      <li key={item.subseriescode} className="min-w-0">
                        <Link
                          to={routes.subseries(item.subseriescode)}
                          onClick={(e) => {
                            if (isModifiedClick(e)) return
                            if (onSelectSubseries) {
                              e.preventDefault()
                              onSelectSubseries(item.subseriescode)
                            }
                          }}
                          className="flex items-baseline justify-between gap-3 px-3 py-2 rounded-xl hover:bg-surface-2 transition-colors group"
                        >
                          <span
                            className="text-sm text-text-body group-hover:text-primary transition-colors truncate"
                            title={item.label}
                          >
                            {item.label}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            {t("subseries.story_count", { count: Number(item.storycount) || 0 })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
