import React from "react"
import { useTranslation } from "react-i18next"
import { Globe, Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

const themeOptions = [
  { value: "light", icon: Sun, labelKey: "theme.light", defaultLabel: "Clair" },
  { value: "dark", icon: Moon, labelKey: "theme.dark", defaultLabel: "Sombre" },
  { value: "system", icon: Monitor, labelKey: "theme.system", defaultLabel: "Système" },
] as const

const languagesList = [
  { code: "fr", name: "Français (FR)", flag: "https://flagcdn.com/w20/fr.png" },
  { code: "en", name: "English (US)", flag: "https://flagcdn.com/w20/us.png" },
  { code: "de", name: "Deutsch (DE)", flag: "https://flagcdn.com/w20/de.png" },
  { code: "es", name: "Español (ES)", flag: "https://flagcdn.com/w20/es.png" },
  { code: "it", name: "Italiano (IT)", flag: "https://flagcdn.com/w20/it.png" },
  { code: "pt", name: "Português (PT)", flag: "https://flagcdn.com/w20/pt.png" },
];

export function GeneralSettingsCard() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  const currentLang = languagesList.find(l => l.code === i18n.language) || languagesList[1];

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          {t("settings.general") || "Général"}
        </CardTitle>
        <CardDescription>
          {t("settings.general_desc") || "Langue de l'interface et thème d'affichage."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t("settings.language") || "Langue"}</Label>
          <Select value={i18n.language} onValueChange={(lang) => i18n.changeLanguage(lang)}>
            <SelectTrigger className="w-full h-10 border-border-subtle bg-surface/50 rounded-xl hover:bg-surface-2">
              <div className="flex items-center gap-2">
                <img 
                  src={currentLang.flag} 
                  className="w-4 h-3 rounded-xs shrink-0 object-cover" 
                  alt="" 
                />
                <span>{currentLang.name}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border-subtle bg-surface">
              {languagesList.map((l) => (
                <SelectItem key={l.code} value={l.code} className="rounded-lg">
                  <div className="flex items-center gap-2">
                    <img src={l.flag} className="w-4 h-3 rounded-xs shrink-0 object-cover" alt="" />
                    <span>{l.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t("settings.theme") || "Thème"}</Label>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ value, icon: Icon, labelKey, defaultLabel }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                className="h-10 rounded-xl gap-2 font-medium text-xs"
                onClick={() => setTheme(value as any)}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t(labelKey) || defaultLabel}</span>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
