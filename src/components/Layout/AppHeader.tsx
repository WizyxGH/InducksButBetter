import React from "react"
import { useTranslation } from "react-i18next"
import { LibraryBig, Settings as SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LanguageToggle } from "@/components/LanguageToggle"
import { ThemeToggle } from "@/components/ThemeToggle"

interface AppHeaderProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  prevTab: string
  setPrevTab: (tab: string) => void
}

export function AppHeader({ activeTab, setActiveTab, prevTab, setPrevTab }: AppHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="px-4 lg:px-12 py-4 shrink-0 border-b border-border-subtle bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <a href="#/entries" className="flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer group">
            <svg className="text-zinc-900 dark:text-white group-hover:text-primary transition-colors" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M10.5563 5.02523C10.3828 5.19867 10.65 5.77054 11.1516 6.29554C12.1781 7.36898 13.9969 8.48929 15.6375 9.06117C15.8953 9.15023 16.5 9.32367 16.9875 9.44085C18.9938 9.93773 20.7984 10.6502 21.3375 11.1612C21.7078 11.508 21.5438 11.7471 20.2031 12.8065C19.4813 13.3784 19.05 13.8002 18.9141 14.0627C18.8063 14.269 18.8063 14.6674 18.9094 14.9534C18.9516 15.0705 19.1063 15.3705 19.2516 15.6237C19.8234 16.6268 19.8844 17.2315 19.4578 17.5924C19.0828 17.9065 18.3703 17.9346 17.3766 17.6768C16.5281 17.4565 15.8344 17.4846 14.9953 17.7705C14.6109 17.9018 14.0203 18.1971 13.6875 18.4221C13.3734 18.633 12.6891 18.9799 12.2016 19.1768C11.0344 19.6409 10.2469 19.5987 9.02344 19.008C6.51094 17.794 3.87188 14.3112 2.68125 10.6409C2.3625 9.65179 2.24063 9.0846 1.98281 7.34554C1.86094 6.52992 1.74844 5.88304 1.72969 5.91585C1.6875 6.00023 1.59375 8.09554 1.59375 8.93929C1.59375 10.5143 1.91719 11.9018 2.61094 13.2893C3.27188 14.6018 4.0875 15.6705 5.57813 17.1612C7.71563 19.3034 9.45938 20.4752 11.0391 20.8362C11.3531 20.9065 11.9859 20.9393 12.3656 20.9018C13.1297 20.8221 13.7484 20.5784 14.6297 19.9924C15.2063 19.608 15.4406 19.5049 16.125 19.3268C16.6688 19.1862 17.6906 19.1252 18.0938 19.219C18.5438 19.3174 19.5188 19.3315 19.9641 19.2518C20.8594 19.0784 21.4453 18.6237 21.5625 18.0096C21.6328 17.6252 21.5531 17.2924 21.2438 16.6877C20.8031 15.8393 20.7281 15.4596 20.8969 15.0096C21.0375 14.644 21.2531 14.3674 22.0312 13.5705C22.9078 12.6705 23.0719 12.4502 23.1 12.1174C23.1141 11.9252 23.0953 11.8268 23.0016 11.644C22.8609 11.3627 22.1391 10.5424 21.7688 10.2424C20.9109 9.54398 19.3031 8.7846 17.5781 8.25492C16.6125 7.96429 16.4344 7.89867 15.6797 7.59398C14.3484 7.0596 13.0922 6.37992 12.1875 5.71429C11.4141 5.1471 10.725 4.85648 10.5563 5.02523Z" />
            </svg>
            <h1 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              {t('header.title')}
            </h1>
          </a>
          <p className="text-muted-foreground text-sm">
            {t('header.subtitle')}
          </p>
        </div>

        <div className="flex flex-row items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (activeTab === "countries") {
                setActiveTab(prevTab);
              } else {
                if (activeTab !== "settings") setPrevTab(activeTab);
                setActiveTab("countries");
              }
            }}
            className={cn(
              "text-text-secondary hover:text-text-body hover:bg-surface-2 rounded-xl transition-all gap-2 border border-transparent",
              activeTab === "countries" && "border-border-subtle bg-surface-2 text-primary"
            )}
          >
            <LibraryBig className="w-5 h-5" />
            <span className="hidden sm:inline">{t('tabs.publications') || "Publications"}</span>
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => {
              if (activeTab === "settings") {
                setActiveTab(prevTab);
              } else {
                if (activeTab !== "countries") setPrevTab(activeTab);
                setActiveTab("settings");
              }
            }}
            className={cn(
              "text-text-secondary hover:text-text-body hover:bg-surface-2 rounded-xl transition-all gap-2 border border-transparent",
              activeTab === "settings" && "border-border-subtle bg-surface-2 text-primary"
            )}
            title={t("settings.title") || "Paramètres"}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="hidden sm:inline">{t('settings.title') || "Paramètres"}</span>
          </Button>

          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
