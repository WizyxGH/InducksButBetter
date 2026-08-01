import { useTranslation } from "react-i18next"
import { Download, CheckCircle, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePwaInstall } from "@/hooks/usePwaInstall"

/**
 * Card displayed in the Settings page that shows:
 * - An "Install App" button when the browser supports PWA install.
 * - A confirmation message when the app is already installed.
 * - Nothing visible when the browser doesn't support install prompts
 *   (e.g. iOS Safari — which uses "Add to Home Screen" instead).
 */
export function PwaInstallCard() {
  const { t } = useTranslation()
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()

  // Already running as a standalone app
  if (isInstalled) {
    return (
      <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            {t("pwa.installed_title", "Application installée")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("pwa.installed_desc", "Vous utilisez déjà InducksButBetter en tant qu'application.")}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          {t("pwa.install_title", "Installer l'application")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t(
            "pwa.install_desc",
            "Installez InducksButBetter sur votre appareil pour un accès rapide, un mode plein écran et une meilleure expérience."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {canInstall ? (
          <Button
            onClick={promptInstall}
            className="rounded-xl gap-2 font-medium w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            {t("pwa.install_button", "Installer")}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t(
              "pwa.install_manual",
              "Sur iOS, appuyez sur le bouton de partage de Safari puis « Sur l'écran d'accueil ». Sur Android, utilisez le menu du navigateur."
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
