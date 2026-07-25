import { useTranslation } from "react-i18next"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

const languagesList = [
  { code: "fr", name: "Français (FR)", flag: "https://flagcdn.com/w20/fr.png" },
  { code: "en", name: "English (US)", flag: "https://flagcdn.com/w20/us.png" },
  { code: "de", name: "Deutsch (DE)", flag: "https://flagcdn.com/w20/de.png" },
  { code: "es", name: "Español (ES)", flag: "https://flagcdn.com/w20/es.png" },
  { code: "it", name: "Italiano (IT)", flag: "https://flagcdn.com/w20/it.png" },
  { code: "pt", name: "Português (PT)", flag: "https://flagcdn.com/w20/pt.png" },
];

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const langCode = (i18n.resolvedLanguage || i18n.language || "en").split('-')[0];
  const currentLang = languagesList.find(l => l.code === langCode) || languagesList[1];

  return (
    <Select value={currentLang.code} onValueChange={(lang) => i18n.changeLanguage(lang)}>
      <SelectTrigger className="w-[auto] sm:w-[150px] px-2.5 sm:px-3 h-10 border-border-subtle bg-surface/80 rounded-xl hover:bg-surface-2 transition-all font-medium text-sm">
        <div className="flex items-center gap-2">
          <img 
            src={currentLang.flag} 
            className="w-4 h-3 rounded-xs shrink-0 object-cover" 
            alt="" 
          />
          <span className="truncate hidden sm:inline">{currentLang.name}</span>
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
  )
}
