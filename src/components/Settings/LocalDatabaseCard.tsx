import React, { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Database, Loader2, Upload, Info, ExternalLink, CloudDownload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { installDatabase, hasLocalDb, getLocalDbStats, clearLocalDbCache, unloadLocalDb } from "@/lib/localDb"

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

/** Formats a byte count into a human-readable string. */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  url?: string
}

const GITHUB_RELEASE_API =
  "https://api.github.com/repos/WizyxGH/InducksButBetter/releases/tags/datas"

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

  const getProgressMessage = (progress: { step: string; current: number; total: number; percent: number }) => {
    switch (progress.step) {
      case 'download':
        return t("localDb.step_download", { percent: progress.percent }) || `Téléchargement : ${progress.percent}%`;
      case 'decompress':
        return t("localDb.step_decompress") || "Décompression de la base...";
      case 'validate':
        return t("localDb.step_validate") || "Vérification de l'intégrité...";
      case 'install':
        return t("localDb.step_install") || "Installation de la base de données...";
      default:
        return t("localDb.progress_start") || "Démarrage...";
    }
  };

  const handleError = (e: any, toastId: string) => {
    console.error(e)
    const msg = e.message || ""
    let translated = msg
    
    if (msg.startsWith("error_download|")) {
      translated = t("localDb.error_download", { msg: msg.split('|')[1] }) || `Failed to download: ${msg.split('|')[1]}`
    } else if (msg.startsWith("error_validation|")) {
      translated = t("localDb.error_validation", { msg: msg.split('|')[1] }) || `Validation failed: ${msg.split('|')[1]}`
    } else if (msg === "error_no_url") {
      translated = t("localDb.error_no_url") || "No database URL or file provided."
    } else if (msg === "error_empty") {
      translated = t("localDb.error_empty") || "Empty database stream."
    } else if (msg.startsWith("error_deserialize|")) {
      translated = t("localDb.error_deserialize", { code: msg.split('|')[1] }) || `Failed to deserialize database (code ${msg.split('|')[1]}).`
    } else if (msg === "error_not_loaded") {
      translated = t("localDb.error_not_loaded") || "Database not loaded."
    }
    
    toast.error(translated, { id: toastId })
  }

  // ─── Local file import ─────────────────────────────────────────────────────

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoadingDb(true)
    const toastId = "settings-db-upload"
    showProgressToast(toastId, t("localDb.progress_start") || "Démarrage...", 0)

    try {
      await installDatabase(file, (progress) => {
        const msg = getProgressMessage(progress);
        showProgressToast(toastId, msg, progress.percent || 0);
      });

      setIsActiveDb(true)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t("localDb.success") || "Base de données installée avec succès !", {
        id: toastId,
      })
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
    showProgressToast(toastId, t("localDb.progress_start") || "Démarrage...", 0)

    try {
      const urls: string[] = []
      try {
        const res = await fetch(GITHUB_RELEASE_API)
        if (res.ok) {
          const release = await res.json()
          const assets: GitHubAsset[] = release.assets || []
          const sqliteAsset = assets.find((a) => a.name === "inducks.sqlite.gz")
          if (sqliteAsset) {
            if (sqliteAsset.url) {
              urls.push(sqliteAsset.url)
            }
            if (sqliteAsset.browser_download_url) {
              urls.push(`https://corsproxy.io/?${encodeURIComponent(sqliteAsset.browser_download_url)}`)
              urls.push(sqliteAsset.browser_download_url)
            }
          }
        }
      } catch (err) {
        console.warn("GitHub Release API fetch failed, using local fallback only:", err)
      }

      const localUrl = `${import.meta.env.BASE_URL}datas/inducks.sqlite.gz`
      const absoluteLocalUrl = new URL(localUrl, window.location.href).href
      urls.push(absoluteLocalUrl)

      await installDatabase(urls, (progress) => {
        const msg = getProgressMessage(progress)
        showProgressToast(toastId, msg, progress.percent || 0)
      })

      setIsActiveDb(true)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t("localDb.success") || "Base de données installée avec succès !", {
        id: toastId,
      })
    } catch (e: any) {
      handleError(e, toastId)
    } finally {
      setIsLoadingDb(false)
    }
  }

  const handleClearCache = async () => {
    if (window.confirm(t("localDb.confirm_clear") || "Voulez-vous vraiment vider le cache de la base de données locale ?")) {
      await clearLocalDbCache();
      unloadLocalDb();
      setIsActiveDb(false);
      window.dispatchEvent(new Event("db-local-unloaded"));
      toast.success(t("localDb.cache_cleared") || "Le cache a été vidé.");
    }
  }

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          {t("localDb.title") || "Base de données Inducks locale"}

          <Popover>
            <PopoverTrigger asChild>
              <button
                className="ml-auto rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t("localDb.instructions_title") || "Comment installer ?"}
              >
                <Info className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-80 text-xs leading-relaxed space-y-3">
              <p className="font-semibold text-sm">
                {t("localDb.instructions_title") || "Comment installer la base de données locale ?"}
              </p>
              <p className="whitespace-pre-line text-muted-foreground">
                {t("localDb.desc_2") ||
                  "Étape 1 : Cliquez sur Importer automatiquement pour télécharger la base compilée.\nOu faites glisser votre propre fichier inducks.sqlite ou inducks.sqlite.gz."}
              </p>
            </PopoverContent>
          </Popover>
        </CardTitle>

        <CardDescription>
          {t("localDb.desc_1") ||
            "Chargez la base de données Inducks pré-compilée et compressée pour travailler 100% hors ligne à vitesse maximale."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        {isActiveDb && (
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">
            <p className="font-semibold">
              {t("localDb.already_imported") || "Base de données active en local."}
            </p>
            {dbStats && (
              <p className="mt-1 opacity-90">
                {t("localDb.imported_stats_new", {
                  count: dbStats.count,
                  size: formatBytes(dbStats.size),
                }) || `${dbStats.count} tables chargées (${formatBytes(dbStats.size)})`}
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleClearCache}
                className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white border-0"
              >
                {t("localDb.clear_cache") || "Vider le cache"}
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
            {t("localDb.btn_cloud") || "Télécharger depuis le Cloud (Recommandé)"}
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
                {t("localDb.btn_select_new") || "Déposer un fichier local"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("localDb.btn_select_sub_new") || "Sélectionnez inducks.sqlite ou inducks.sqlite.gz"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
