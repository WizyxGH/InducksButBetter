import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Orbit, Search } from "lucide-react"
import { getUniverseList } from "@/lib/dataService"
import { DetailLoading } from "@/components/Layout/DetailPage"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/components/ui/link"
import { routes } from "@/lib/routes"
import { isModifiedClick } from "@/lib/navigation"
import { matchesUniverseQuery } from "@/lib/universes"
import { toast } from "sonner"

interface UniverseListProps {
  onSelectUniverse?: (code: string) => void
}

/** Catalogue of every character universe Inducks defines. */
export function UniverseList({ onSelectUniverse }: UniverseListProps) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    async function fetchList() {
      setLoading(true)
      try {
        setRows(await getUniverseList(i18n.language))
      } catch (e) {
        console.error(e)
        toast.error(t("common.error"))
      } finally {
        setLoading(false)
      }
    }
    fetchList()
  }, [i18n.language])

  // Only ~163 universes, so the whole catalogue is filtered client-side and
  // matches the name in any language, not only the displayed one.
  const filtered = useMemo(
    () => rows.filter((r) => matchesUniverseQuery(r, query)),
    [rows, query]
  )

  if (loading) return <DetailLoading />

  return (
    <div className="h-full overflow-y-auto bg-surface-2/20">
      <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Orbit className="w-6 h-6 text-primary" />
            {t("universes.list_title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("universes.list_subtitle")}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("universes.list_search")}
            className="pl-9 h-11 rounded-xl bg-surface"
          />
        </div>

        <p className="text-xs text-muted-foreground font-medium">
          {t("universes.count", { count: filtered.length })}
        </p>

        {filtered.length === 0 ? (
          <p className="text-sm text-text-secondary italic">{t("common.no_data")}</p>
        ) : (
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
            <CardContent className="p-2">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filtered.map((item) => (
                  <li key={item.universecode} className="min-w-0">
                    <Link
                      to={routes.universe(item.universecode)}
                      onClick={(e) => {
                        if (isModifiedClick(e)) return
                        if (onSelectUniverse) {
                          e.preventDefault()
                          onSelectUniverse(item.universecode)
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
                        {t("universes.character_count", { count: Number(item.charactercount) || 0 })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
