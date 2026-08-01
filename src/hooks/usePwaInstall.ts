import { useEffect, useState } from 'react'

/**
 * Captures the browser's `beforeinstallprompt` event and exposes
 * an imperative `promptInstall()` function so the UI can trigger
 * the native install dialog on demand.
 *
 * Also tracks whether the app is already running in standalone
 * (installed) mode via the `isInstalled` flag.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone / TWA / fullscreen)
    const mql = window.matchMedia('(display-mode: standalone)')
    setIsInstalled(mql.matches)

    const handleDisplayChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches)
    }
    mql.addEventListener('change', handleDisplayChange)

    // Intercept the browser install prompt so we can trigger it later
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Clear the deferred prompt once the user installs
    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      mql.removeEventListener('change', handleDisplayChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  /**
   * Triggers the native browser install prompt.
   * Returns `true` if the user accepted the install.
   */
  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false
    const prompt = deferredPrompt as any
    prompt.prompt()
    const result = await prompt.userChoice
    setDeferredPrompt(null)
    return result.outcome === 'accepted'
  }

  return {
    /** Whether the install prompt can be shown */
    canInstall: !!deferredPrompt,
    /** Whether the app is running in standalone mode */
    isInstalled,
    /** Call to show the native install prompt */
    promptInstall,
  }
}
