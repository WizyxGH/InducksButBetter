import React from "react"
import { useTranslation } from "react-i18next"
import { HelpCircle, ExternalLink, Scale, Languages } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DiscordIcon } from "@/components/icons/DiscordIcon"
import { Github } from "lucide-react"
import { LegalModal } from "@/components/LegalModal"

export function CommunityLinksCard() {
  const { t } = useTranslation()

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          {t("settings.links") || "Liens utiles & Communauté"}
        </CardTitle>
        <CardDescription>
          {t("settings.links_desc") || "Rejoignez la communauté Inducks ou contribuez au projet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="https://discord.gg/trPVaPwDJz"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface/50 hover:bg-surface-2 hover:-translate-y-0.5 active:scale-98 hover:shadow-xs transition-all duration-300 group"
        >
          <div className="flex items-center gap-3">
            <DiscordIcon className="w-5 h-5 text-[#5865F2] shrink-0 group-hover:scale-105 transition-transform" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Discord</p>
              <p className="text-[10px] text-muted-foreground">{t("settings.discord") || "Discord de Inducks"}</p>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
        </a>

        <a
          href="https://github.com/WizyxGH/InducksButBetter"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface/50 hover:bg-surface-2 hover:-translate-y-0.5 active:scale-98 hover:shadow-xs transition-all duration-300 group"
        >
          <div className="flex items-center gap-3">
            <Github className="w-5 h-5 text-foreground shrink-0 group-hover:scale-105 transition-transform" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">GitHub</p>
              <p className="text-[10px] text-muted-foreground">{t("settings.contribute") || "Contribuer au projet"}</p>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
        </a>

        <a
          href="https://crowdin.com/project/inducksbutbetter"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface/50 hover:bg-surface-2 hover:-translate-y-0.5 active:scale-98 hover:shadow-xs transition-all duration-300 group"
        >
          <div className="flex items-center gap-3">
            <Languages className="w-5 h-5 text-green-500 shrink-0 group-hover:scale-105 transition-transform" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Translations</p>
              <p className="text-[10px] text-muted-foreground">{t("settings.translate") || "Traduire le projet"}</p>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
        </a>

        <div className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface/50 hover:bg-surface-2 hover:-translate-y-0.5 active:scale-98 hover:shadow-xs transition-all duration-300 group cursor-pointer">
          <div className="flex items-center gap-3 w-full">
            <Scale className="w-5 h-5 text-primary shrink-0 group-hover:scale-105 transition-transform" />
            <div className="space-y-0.5 w-full">
              <p className="text-xs font-bold text-foreground">{t("legal.title") || "Mentions légales"}</p>
              <div className="text-[10px] text-muted-foreground">
                <LegalModal />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
