import React, { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Database, Loader2, Upload, Info, ExternalLink, CloudDownload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { installDatabase, hasLocalDb, getLocalDbStats, clearLocalDbCache, unloadLocalDb } from "@/lib/localDb"
import {
  describeInstallError,
  describeInstallProgress,
  formatBytes,
  resolveDatabaseSources,
  type InstallProgress,
} from "@/lib/dbInstall"

/**
 * Renders a progress bar inside a toast notification.
 */
function ToastProgress({ msg, percent }: { msg: string; percent: number }) {
  return (
    <div className="flex flex-col gap-2 w-full min-w-[260px] mt-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold truncate" title={msg}>{msg}</span>
        <span className="text-sm font-mono font-bold text-primary shrink-0">{percent}%</span>
      </div>
      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function LocalDatabaseCard() {
  const { t } = useTranslation()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoadingDb, setIsLoadingDb] = useState(false)
  const [isActiveDb, setIsActiveDb] = useState(hasLocalDb())
  const dbStats = getLocalDbStats()

  // Listen to db load events to update UI
  React.useEffect(() => {
    const handleDbLoaded = () => setIsActiveDb(true);
    window.addEventListener("db-local-loaded", handleDbLoaded);
    return () => window.removeEventListener("db-local-loaded", handleDbLoaded);
  }, []);

  const showProgressToast = (toastId: string, msg: string, percent: number) => {
    toast.loading(<ToastProgress msg={msg} percent={percent} />, { id: toastId })
  }

  const reportProgress = (toastId: string) => (progress: InstallProgress) =>
    showProgressToast(toastId, describeInstallProgress(progress, t), Math.round(progress.percent || 0))

  const handleError = (e: unknown, toastId: string) => {
    console.error(e)
    toast.error(describeInstallError(e, t), { id: toastId, duration: 10000 })
  }

  // ─── Local file import ─────────────────────────────────────────────────────

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoadingDb(true)
    const toastId = "settings-db-upload"
    showProgressToast(toastId, t("localDb.progress_start"), 0)

    try {
      await installDatabase(file, reportProgress(toastId));

      setIsActiveDb(true)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t("localDb.success"), { id: toastId })
    } catch (e: any) {
      handleError(e, toastId)
    } finally {
      setIsLoadingDb(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // ─── Cloud import (GitHub Releases) ────────────────────────────────────────

  const handleCloudImport = async () => {
    setIsLoadingDb(true)
    const toastId = "settings-db-cloud"
    showProgressToast(toastId, t("localDb.progress_start"), 0)

    try {
      const urls = await resolveDatabaseSources(import.meta.env.BASE_URL, window.location.href)
      await installDatabase(urls, reportProgress(toastId))

      setIsActiveDb(true)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t("localDb.success"), { id: toastId })
    } catch (e: any) {
      handleError(e, toastId)
    } finally {
      setIsLoadingDb(false)
    }
  }

  const handleClearCache = async () => {
    if (window.confirm(t("localDb.confirm_clear"))) {
      await clearLocalDbCache();
      unloadLocalDb();
      setIsActiveDb(false);
      window.dispatchEvent(new Event("db-local-unloaded"));
      toast.success(t("localDb.cache_cleared"));
    }
  }

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          {t("localDb.title")}

          <Popover>
            <PopoverTrigger asChild>
              <button
                className="ml-auto rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t("localDb.instructions_title")}
              >
                <Info className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-80 text-xs leading-relaxed space-y-3">
              <p className="font-semibold text-sm">
                {t("localDb.instructions_title")}
              </p>
              <p className="whitespace-pre-line text-muted-foreground">
                {t("localDb.desc_2")}
              </p>
            </PopoverContent>
          </Popover>
        </CardTitle>

        <CardDescription>
          {t("localDb.desc_1")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        {isActiveDb && (
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">
            <p className="font-semibold">
              {t("localDb.already_imported")}
            </p>
            {dbStats && (
              <p className="mt-1 opacity-90">
                {t("localDb.imported_stats_new", {
                  count: dbStats.count,
                  size: formatBytes(dbStats.size),
                })}
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleClearCache}
                className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white border-0"
              >
                {t("localDb.clear_cache")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".sqlite,.sqlite3,.gz,.db"
            className="hidden"
          />

          <Button
            onClick={handleCloudImport}
            disabled={isLoadingDb}
            className="w-full gap-2 rounded-xl"
          >
            {isLoadingDb ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudDownload className="w-4 h-4" />
            )}
            {t("localDb.btn_cloud")}
          </Button>

          <div
            onClick={() => !isLoadingDb && fileInputRef.current?.click()}
            className={cn(
              "w-full border-2 border-dashed border-border-subtle transition-colors rounded-xl p-6",
              "flex flex-col items-center justify-center gap-3 text-center",
              isLoadingDb
                ? "opacity-70 cursor-not-allowed bg-surface-2"
                : "cursor-pointer hover:border-primary/50 hover:bg-surface-2"
            )}
          >
            {isLoadingDb ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            ) : (
              <div className="p-3 bg-primary/10 rounded-full">
                <Upload className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <p className="font-semibold text-sm text-foreground">
                {t("localDb.btn_select_new")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("localDb.btn_select_sub_new")}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
