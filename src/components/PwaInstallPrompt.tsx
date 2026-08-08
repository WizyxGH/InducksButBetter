import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { usePwaInstall } from "@/hooks/usePwaInstall"
import {
  isDismissalActive,
  isMobileDevice,
  readDismissal,
  rememberDismissal,
  shouldOfferInstall,
} from "@/lib/pwaInstall"

/** Renders nothing; it only offers the install once, as a toast. */
export function PwaInstallPrompt() {
  const { t } = useTranslation()
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()
  // The offer is made once per page load, however often `canInstall` flips.
  const offered = useRef(false)

  useEffect(() => {
    if (offered.current) return
    const state = {
      canInstall,
      isInstalled,
      isMobile: isMobileDevice(),
      dismissed: isDismissalActive(readDismissal(), Date.now()),
    }
    if (!shouldOfferInstall(state)) return

    offered.current = true

    // Delayed so it does not land on top of the first paint, or compete with
    // the database-install toast on a first visit.
    const timer = window.setTimeout(() => {
      toast(t("pwa.install_title"), {
        description: t("pwa.install_description"),
        duration: 15000,
        action: {
          label: t("pwa.install_action"),
          onClick: () => {
            // A refusal inside the native dialog counts as a refusal here too,
            // otherwise the toast would reappear on the next visit.
            void promptInstall().then((accepted) => {
              if (!accepted) rememberDismissal()
            })
          },
        },
        cancel: {
          label: t("pwa.install_dismiss"),
          onClick: () => rememberDismissal(),
        },
        onDismiss: () => rememberDismissal(),
      })
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [canInstall, isInstalled, promptInstall, t])

  return null
}
