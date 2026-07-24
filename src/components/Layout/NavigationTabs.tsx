import React from "react"
import { useTranslation } from "react-i18next"
import { BookOpen, LibraryBig, User, Cat, Database as DbIcon } from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface NavigationTabsProps {
  activeTab: string
}

export function NavigationTabs({ activeTab }: NavigationTabsProps) {
  const { t } = useTranslation()

  if (activeTab === "settings" || activeTab === "countries") {
    return null
  }

  return (
    <div className="px-4 lg:px-12 shrink-0 flex w-full bg-surface border-b border-border-subtle py-2">
      <TabsList className="bg-surface-2/90 gap-1 h-12 p-1.5 rounded-2xl border border-border-subtle shadow-inner w-full flex justify-between items-center overflow-x-auto overflow-y-hidden">
        <TabsTrigger
          value="stories"
          className="data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium transition-all flex-1"
        >
          <BookOpen className={cn("w-4 h-4 shrink-0", activeTab === "stories" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.stories')}</span>
        </TabsTrigger>
        <TabsTrigger
          value="publications"
          className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
        >
          <LibraryBig className={cn("w-4 h-4 shrink-0", activeTab === "publications" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.publications')}</span>
        </TabsTrigger>
        <TabsTrigger
          value="authors"
          className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
        >
          <User className={cn("w-4 h-4 shrink-0", activeTab === "authors" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.authors')}</span>
        </TabsTrigger>
        <TabsTrigger
          value="characters"
          className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
        >
          <Cat className={cn("w-4 h-4 shrink-0", activeTab === "characters" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.characters')}</span>
        </TabsTrigger>
        <TabsTrigger
          value="sql"
          className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
        >
          <DbIcon className={cn("w-4 h-4 shrink-0", activeTab === "sql" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.sql')}</span>
        </TabsTrigger>
      </TabsList>
    </div>
  )
}
