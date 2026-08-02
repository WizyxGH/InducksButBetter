import { useRef, useState } from "react"
import { installDatabase, hasLocalDb, getLocalDbStats } from "@/lib/localDb"
import { Database, Loader2, Upload, CloudDownload } from "lucide-react"
import { toast } from "sonner"
import { useTranslation, Trans } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function ToastProgress({ msg, percent }: { msg: string; percent: number }) {
  return (
    <div className="flex flex-col gap-2 w-full mt-1">
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-medium leading-tight flex-1 break-words">{msg}</span>
        <span className="text-xs font-mono font-bold text-primary shrink-0 mt-0.5">{percent}%</span>
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

const GITHUB_RELEASE_API =
  "https://api.github.com/repos/WizyxGH/InducksButBetter/releases/tags/datas"

export function LocalDbUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isActive, setIsActive] = useState(hasLocalDb())
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useTranslation()

  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const stats = getLocalDbStats()

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setProgressMsg(t('localDb.progress_start') || "Démarrage...")
    
    const toastId = "db-upload-toast"
    toast.loading(<ToastProgress msg={t('localDb.progress_start') || "Démarrage..."} percent={0} />, { id: toastId })

    try {
      await installDatabase(file, (progress) => {
        const msg = getProgressMessage(progress);
        setProgressMsg(msg)
        const percent = Math.round(progress.percent || 0)
        toast.loading(<ToastProgress msg={msg} percent={percent} />, { id: toastId })
      })
      setIsActive(true)
      setIsOpen(false)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t('localDb.success') || "Base de données installée avec succès !", { id: toastId })
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to load database.", { id: toastId })
    } finally {
      setIsLoading(false)
      setProgressMsg(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleCloudImport = async () => {
    setIsLoading(true)
    setProgressMsg(t('localDb.progress_start') || "Démarrage...")
    
    const toastId = "db-upload-toast"
    toast.loading(<ToastProgress msg={t('localDb.progress_start') || "Démarrage..."} percent={0} />, { id: toastId })

    try {
      const urls: string[] = []
      try {
        const res = await fetch(GITHUB_RELEASE_API)
        if (res.ok) {
          const release = await res.json()
          const assets = release.assets || []
          const sqliteAsset = assets.find((a: any) => a.name === "inducks.sqlite.gz")
          if (sqliteAsset) {
            if (sqliteAsset.url) {
              urls.push(sqliteAsset.url)
            }
            if (sqliteAsset.browser_download_url) {
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
        setProgressMsg(msg)
        const percent = Math.round(progress.percent || 0)
        toast.loading(<ToastProgress msg={msg} percent={percent} />, { id: toastId })
      })
      setIsActive(true)
      setIsOpen(false)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t('localDb.success') || "Base de données installée avec succès !", { id: toastId })
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to load database.", { id: toastId })
    } finally {
      setIsLoading(false)
      setProgressMsg(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className={`flex items-center gap-2 px-3 py-2 h-10 text-sm font-medium rounded-xl border transition-all ${
            isActive && !isLoading
              ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" 
              : isLoading 
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-surface/80 text-muted-foreground border-border-subtle hover:bg-surface-2 hover:text-foreground"
          }`}
          title={isActive ? t('localDb.tooltip_active') : t('localDb.tooltip_upload')}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isActive ? (
            <Database className="w-4 h-4" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {isLoading ? (t('localDb.progress_start') || "Installation...") : isActive ? t('localDb.btn_local') : t('localDb.btn_import')}
          </span>
        </button>
      </DialogTrigger>
      
      <DialogContent 
        className="w-[calc(100%-2rem)] sm:max-w-md rounded-xl"
      >
        <DialogHeader>
          <DialogTitle>{t('localDb.title')}</DialogTitle>
          <DialogDescription className="pt-2 space-y-3" asChild>
            <div>
              <div>
                {t('localDb.desc_1')}
              </div>
              {isActive && (
                <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm">
                  <p>{t('localDb.already_imported')}</p>
                  {stats && (
                    <p className="mt-1 opacity-90 font-medium">
                      {t('localDb.imported_stats_new', { count: stats.count, size: formatBytes(stats.size) }) || `${stats.count} tables chargées (${formatBytes(stats.size)})`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".sqlite,.sqlite3,.gz,.db"
            className="hidden"
          />

          <Button
            onClick={handleCloudImport}
            disabled={isLoading}
            className="w-full gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudDownload className="w-4 h-4" />
            )}
            {t("localDb.btn_cloud") || "Télécharger depuis le Cloud (Recommandé)"}
          </Button>

          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            variant="outline"
            className="w-full gap-2 border-dashed border-2 hover:bg-muted"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {t('localDb.btn_select_new') || "Déposer un fichier local"}
          </Button>

          {isLoading && progressMsg && (
            <p className="text-sm text-center text-muted-foreground animate-pulse mt-2">
              {progressMsg}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
