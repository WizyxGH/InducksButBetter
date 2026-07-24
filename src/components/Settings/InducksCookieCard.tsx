import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Monitor, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function InducksCookieCard() {
  const { t } = useTranslation()
  const [cookieValue, setCookieValue] = useState("")
  const [isSavingCookie, setIsSavingCookie] = useState(false)

  useEffect(() => {
    // Load existing cookie from localStorage
    const loadCookie = () => {
      const saved = localStorage.getItem("inducks_cookie")
      if (saved) {
        setCookieValue(saved)
      }
    }
    loadCookie()
  }, [])

  const handleSaveCookie = () => {
    setIsSavingCookie(true)
    try {
      localStorage.setItem("inducks_cookie", cookieValue)
      toast.success(t("settings.cookie_saved") || "Cookie enregistré avec succès !")
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde du cookie.")
    } finally {
      setIsSavingCookie(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          {t("settings.inducks_cookie") || "Cookie Inducks"}
        </CardTitle>
        <CardDescription>
          {t("settings.cookie_desc") || "Nécessaire pour charger les images en haute résolution depuis Inducks."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <div className="space-y-2">
          <Label htmlFor="inducks-cookie" className="text-xs font-semibold">
            Cookie (coa-session, etc.)
          </Label>
          <Input
            id="inducks-cookie"
            placeholder="Ex: coa-session=..."
            value={cookieValue}
            onChange={(e) => setCookieValue(e.target.value)}
            className="h-10 border-border-subtle bg-surface/50 rounded-xl"
          />
          <p className="text-[10px] text-muted-foreground leading-normal">
            {t("settings.cookie_help") ||
              "Ce cookie permet d'accéder aux images haute résolution. Récupérez-le dans l'inspecteur du navigateur sur inducks.org."}
          </p>
        </div>
        <div className="mt-auto pt-4">
          <Button onClick={handleSaveCookie} disabled={isSavingCookie} className="w-full gap-2 rounded-xl">
            {isSavingCookie ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("common.save") || "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
