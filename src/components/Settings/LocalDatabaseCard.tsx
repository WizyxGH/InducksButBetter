import React, { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Database, Loader2, Upload, Info, ExternalLink, CloudDownload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { loadFromIsvFiles, loadFromCloud, hasLocalDb, getLocalDbStats, clearLocalDbCache, unloadLocalDb } from "@/lib/localDb"

/**
 * Renders a progress bar inside a toast notification.
 * Avoids w-full + justify-between to prevent large empty gaps when
 * Sonner's content area is narrower than the full toast width.
 */
function ToastProgress({ msg, percent }: { msg: string; percent: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 w-full min-w-[260px] mt-1">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">{t("localDb.global_progress", "Progression globale")}</span>
          <span className="text-sm font-mono font-bold text-primary">{percent}%</span>
        </div>
        <span className="text-xs text-muted-foreground truncate" title={msg}>{msg}</span>
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

/** Formats a byte count into a human-readable string (e.g. "12.5 MB"). */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

/** GitHub release asset descriptor used by the cloud import flow. */
interface GitHubAsset {
  name: string
  url: string
  browser_download_url: string
  size: number
}

/** GitHub Releases API URL pointing to the ISV database bundle. */
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

  // ─── Shared progress toast helper ──────────────────────────────────────────

  /**
   * Displays (or updates) a loading toast with a progress bar.
   * @param toastId - Stable ID so Sonner updates the same toast instead of creating a new one.
   * @param msg     - Current status label.
   * @param percent - Completion percentage (0–100).
   */
  const showProgressToast = (toastId: string, msg: string, percent: number) => {
    toast.loading(<ToastProgress msg={msg} percent={percent} />, { id: toastId })
  }

  // ─── Local file import ─────────────────────────────────────────────────────

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsLoadingDb(true)
    const toastId = "settings-db-upload"
    const startMsg = t("localDb.progress_start")
    showProgressToast(toastId, startMsg, 0)

    try {
      await loadFromIsvFiles(Array.from(files), (progress) => {
        const msg = progress.table === "caching" 
          ? t("localDb.caching_step") || "Mise en cache (cela peut prendre quelques secondes)..."
          : t("localDb.progress_importing", {
              table: progress.table,
              current: progress.current,
              total: progress.total,
            })
        showProgressToast(toastId, msg, progress.percent)
      })

      setIsActiveDb(true)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t("localDb.success") || "Base de données locale importée avec succès !", {
        id: toastId,
      })
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || "Failed to load database", { id: toastId })
    } finally {
      setIsLoadingDb(false)
      // Reset the file input so the same files can be re-imported if needed
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // ─── Cloud import (GitHub Releases) ────────────────────────────────────────

  /**
   * Downloads all ISV files from the project's GitHub Release and imports them.
   * Uses the GitHub API asset URL (api.github.com) instead of browser_download_url
   * (github.com) because the latter blocks CORS requests from the browser.
   */
  const handleCloudImport = async () => {
    setIsLoadingDb(true)
    const toastId = "settings-db-cloud"
    const startMsg = t("localDb.progress_start")
    showProgressToast(toastId, startMsg, 0)

    try {
      const res = await fetch(GITHUB_RELEASE_API)
      if (!res.ok) throw new Error("Failed to fetch release info from GitHub")

      const release = await res.json()
      const assets: GitHubAsset[] = release.assets || []

      // Point the download URLs to our local deployment path (public/datas/)
      // to bypass CORS and proxy issues, since the files are bundled in the build
      const isvAssets = assets
        .filter((a) => a.name.endsWith(".isv"))
        .map((a) => ({
          name: a.name,
          url: `${import.meta.env.BASE_URL}datas/${a.name}`,
          size: a.size,
        }))

      if (isvAssets.length === 0) throw new Error("No .isv files found in the GitHub release")

      await loadFromCloud(isvAssets, (progress) => {
        const msg = t("localDb.progress_importing", {
              table: progress.table,
              current: progress.current,
              total: progress.total,
            })
        showProgressToast(toastId, msg, progress.percent)
      })

      setIsActiveDb(true)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t("localDb.success") || "Base de données locale importée avec succès !", {
        id: toastId,
      })
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || "Failed to load cloud database", { id: toastId })
    } finally {
      setIsLoadingDb(false)
    }
  }

  // ─── Clear Cache ────────────────────────────────────────────────────────────

  const handleClearCache = async () => {
    if (window.confirm(t("localDb.confirm_clear") || "Voulez-vous vraiment vider le cache de la base de données locale ?")) {
      await clearLocalDbCache();
      unloadLocalDb();
      setIsActiveDb(false);
      toast.success(t("localDb.cache_cleared") || "Le cache a été vidé.");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          {t("localDb.title") || "Base de données Inducks locale"}

          {/* ⓘ Info popover — opens on click, shows installation instructions */}
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
                  "Étape 1 : Téléchargez tous les fichiers ISV via le lien ci-dessous.\nÉtape 2 : Cliquez sur la zone d'importation et sélectionnez la totalité de ces fichiers (.isv)."}
              </p>
              <a
                href="https://mega.nz/folder/lSZ3BSIa#5ygCpsBRQrd8JCxvfmMaFg"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                {t("settings.download_isv") || "Télécharger les fichiers ISV (depuis Mega)"}
              </a>
            </PopoverContent>
          </Popover>
        </CardTitle>

        <CardDescription>
          {t("localDb.desc_1") ||
            "Chargez les fichiers .isv extraits de la base de données Inducks officielle pour travailler hors ligne."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Active DB badge */}
        {isActiveDb && (
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">
            <p className="font-semibold">
              {t("localDb.already_imported") || "Base de données active en local."}
            </p>
            {dbStats && (
              <p className="mt-1 opacity-90">
                {t("localDb.imported_stats", {
                  count: dbStats.count,
                  size: formatBytes(dbStats.size),
                }) || `${dbStats.count} tables importées (${formatBytes(dbStats.size)})`}
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

        <div className="flex flex-col gap-3 mt-auto pt-4">
          {/* Hidden native file picker */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".isv"
            className="hidden"
          />

          {/* ── Manual file drop zone ──────────────────────────────────────── */}
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
                {t("localDb.btn_select") || "Cliquez ici pour importer les fichiers"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("localDb.btn_select_sub") || "Sélectionnez tous les fichiers .isv extraits"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
