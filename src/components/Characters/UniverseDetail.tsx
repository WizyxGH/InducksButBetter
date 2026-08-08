import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Cat, Globe, Orbit } from "lucide-react"
import { getUniverseDetail } from "@/lib/dataService"
import { DetailBackButton, DetailLoading, DetailNotFound } from "@/components/Layout/DetailPage"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/components/ui/link"
import { routes } from "@/lib/routes"
import { isModifiedClick } from "@/lib/navigation"
import { pickUniverseName, listUniverseNames } from "@/lib/universes"
import { useMetadata } from "@/hooks/useMetadata"
import { cleanComment } from "@/lib/utils"
import { toast } from "sonner"

interface UniverseDetailProps {
  universecode: string
  onBack: () => void
  onSelectCharacter?: (code: string, name: string) => void
}

/** A universe and the characters it gathers, like universe.php. */
export function UniverseDetail({ universecode, onBack, onSelectCharacter }: UniverseDetailProps) {
  const { t, i18n } = useTranslation()
  const { meta } = useMetadata()
  const [loading, setLoading] = useState(true)
  const [universe, setUniverse] = useState<any>(null)

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true)
      try {
        setUniverse(await getUniverseDetail(universecode, i18n.language))
      } catch (e) {
        console.error(e)
        toast.error(t("common.error"))
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [universecode, i18n.language])

  if (loading) return <DetailLoading />
  if (!universe) return <DetailNotFound message={t("universes.not_found")} onBack={onBack} />

  const displayName = pickUniverseName(universe.names, i18n.language, universe.universecode)
  const otherNames = listUniverseNames(universe.names).filter((n) => n.universename !== displayName)
  const characters: any[] = universe.characters || []
  const comment = universe.universecomment ? cleanComment(universe.universecomment) : ""
  const languageName = (code: string) =>
    meta.languages.find((l) => l.languagecode === code)?.languagename || code.toUpperCase()

  return (
    <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <DetailBackButton onClick={onBack} />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight flex items-center gap-2">
          <Orbit className="w-6 h-6 text-primary shrink-0" />
          {displayName}
        </h1>
        <p className="text-xs text-muted-foreground font-mono">{universe.universecode}</p>
        {comment && <p className="text-sm text-text-body leading-relaxed">{comment}</p>}
      </div>

      {/* Names in the other languages, as on the reference site. */}
      {otherNames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            {t("universes.other_names")}
          </h3>
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
            <CardContent className="p-4">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {otherNames.map((name) => (
                  <li key={name.languagecode} className="flex items-baseline gap-2 text-sm min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide shrink-0 capitalize">
                      {languageName(name.languagecode)}
                    </span>
                    <span className="text-text-body truncate" title={name.universename}>
                      {name.universename}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Cat className="w-4 h-4 text-primary" />
          {t("universes.characters")}
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
            {characters.length}
          </span>
        </h3>

        {characters.length === 0 ? (
          <p className="text-sm text-text-secondary italic">{t("universes.no_characters")}</p>
        ) : (
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
            <CardContent className="p-2">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {characters.map((char) => (
                  <li key={char.charactercode} className="min-w-0">
                    <Link
                      to={routes.character(char.charactercode)}
                      onClick={(e) => {
                        if (isModifiedClick(e)) return
                        if (onSelectCharacter) {
                          e.preventDefault()
                          onSelectCharacter(char.charactercode, char.charactername)
                        }
                      }}
                      className="flex items-baseline justify-between gap-3 px-3 py-2 rounded-xl hover:bg-surface-2 transition-colors group"
                    >
                      <span
                        className="text-sm text-text-body group-hover:text-primary transition-colors truncate"
                        title={char.charactername}
                      >
                        {char.charactername}
                      </span>
                      {char.originalcharactername !== char.charactername && (
                        <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[45%] italic">
                          {char.originalcharactername}
                        </span>
                      )}
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
