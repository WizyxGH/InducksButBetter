import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Monitor, Loader2, Save, Info } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { sendCookieToProxy } from "@/lib/imageProxy"
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

  const handleSaveCookie = async () => {
    setIsSavingCookie(true)
    try {
      localStorage.setItem("inducks_cookie", cookieValue)
      // The value only does anything once the local proxy has it: the proxy
      // runs server-side and cannot read the browser's cookies.
      const delivered = await sendCookieToProxy(cookieValue)
      if (delivered) {
        toast.success(t("settings.cookie_saved"))
      } else {
        toast.warning(t("settings.cookie_saved_no_proxy"))
      }
    } catch (e) {
      toast.error(t("settings.cookie_save_error"))
    } finally {
      setIsSavingCookie(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          {t("settings.inducks_cookie")}

          <Popover>
            <PopoverTrigger asChild>
              <button
                className="ml-auto rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t("settings.cookie_help")}
              >
                <Info className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-80 text-xs leading-relaxed">
              <p className="whitespace-pre-line text-muted-foreground">
                {t("settings.cookie_help")}
              </p>
            </PopoverContent>
          </Popover>
        </CardTitle>
        <CardDescription>
          {t("settings.cookie_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <div className="space-y-2">
          <Label htmlFor="inducks-cookie" className="text-xs font-semibold">
            Cookie (coa-session, etc.)
          </Label>
          <Input
            id="inducks-cookie"
            placeholder={t("common.example", { value: "coa-session=..." })}
            value={cookieValue}
            onChange={(e) => setCookieValue(e.target.value)}
            className="h-10 border-border-subtle bg-surface/50 rounded-xl"
          />
        </div>
        <div className="mt-auto pt-4">
          <Button onClick={handleSaveCookie} disabled={isSavingCookie} className="w-full gap-2 rounded-xl">
            {isSavingCookie ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("common.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
