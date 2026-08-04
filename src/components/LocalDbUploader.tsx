import { useRef, useState } from "react"
import { installDatabase, hasLocalDb, getLocalDbStats } from "@/lib/localDb"
import {
  describeInstallError,
  describeInstallProgress,
  formatBytes,
  resolveDatabaseSources,
  type InstallProgress,
} from "@/lib/dbInstall"
import { Database, Loader2, Upload, CloudDownload } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
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

export function LocalDbUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isActive, setIsActive] = useState(hasLocalDb())
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useTranslation()

  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const stats = getLocalDbStats()

  const TOAST_ID = "db-upload-toast"

  const reportProgress = (progress: InstallProgress) => {
    const msg = describeInstallProgress(progress, t)
    setProgressMsg(msg)
    toast.loading(<ToastProgress msg={msg} percent={Math.round(progress.percent || 0)} />, { id: TOAST_ID })
  }

  /** Runs an install flow with shared toast / loading / error handling. */
  const runInstall = async (install: () => Promise<void>) => {
    setIsLoading(true)
    setProgressMsg(t('localDb.progress_start'))
    toast.loading(<ToastProgress msg={t('localDb.progress_start')} percent={0} />, { id: TOAST_ID })

    try {
      await install()
      setIsActive(true)
      setIsOpen(false)
      window.dispatchEvent(new Event("db-local-loaded"))
      toast.success(t('localDb.success'), { id: TOAST_ID })
    } catch (error) {
      console.error(error)
      toast.error(describeInstallError(error, t), { id: TOAST_ID, duration: 10000 })
    } finally {
      setIsLoading(false)
      setProgressMsg(null)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    await runInstall(() => installDatabase(file, reportProgress))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCloudImport = () =>
    runInstall(async () => {
      const urls = await resolveDatabaseSources(import.meta.env.BASE_URL, window.location.href)
      await installDatabase(urls, reportProgress)
    })

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
            {isLoading ? (t('localDb.progress_start')) : isActive ? t('localDb.btn_local') : t('localDb.btn_import')}
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
                      {t('localDb.imported_stats_new', { count: stats.count, size: formatBytes(stats.size) })}
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
            {t("localDb.btn_cloud")}
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
            {t('localDb.btn_select_new')}
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
