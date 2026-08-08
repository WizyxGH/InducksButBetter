import React from "react"
import { useTranslation } from "react-i18next"
import { GeneralSettingsCard } from "./Settings/GeneralSettingsCard"
import { LocalDatabaseCard } from "./Settings/LocalDatabaseCard"
import { InducksCookieCard } from "./Settings/InducksCookieCard"
import { PersonalCollectionCard } from "./Settings/PersonalCollectionCard"
import { CommunityLinksCard } from "./Settings/CommunityLinksCard"

export function Settings() {
  const { t } = useTranslation()

  return (
    <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-8 pb-20">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {t("settings.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("settings.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language and theme live here since the header toggles were removed:
            this card is the only remaining way to change them. */}
        <GeneralSettingsCard />
        <LocalDatabaseCard />
        <InducksCookieCard />
        <PersonalCollectionCard />
        <CommunityLinksCard />
      </div>
    </div>
  )
}
