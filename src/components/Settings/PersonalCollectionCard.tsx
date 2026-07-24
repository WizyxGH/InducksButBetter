import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Database, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function PersonalCollectionCard() {
  const { t } = useTranslation()
  const [collectionText, setCollectionText] = useState("")
  const [collectionCount, setCollectionCount] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("inducks_collection_issues")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setCollectionText(parsed.map((code) => `${code}^1`).join("\n"))
          setCollectionCount(parsed.length)
        }
      }
    } catch (e) {
      console.error("Failed to load collection", e)
    }
  }, [])

  const handleSaveCollection = () => {
    const issues = collectionText
      .split(/[\n;]+/)
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.includes("^")) {
          const parts = trimmed.split("^");
          if (parts[0]) {
            return parts[0].trim();
          }
        }
        return null;
      })
      .filter((line): line is string => line !== null && line.length > 0)

    localStorage.setItem("inducks_collection_issues", JSON.stringify(issues))
    setCollectionCount(issues.length)
    toast.success(t("collection.saved_success") || "Collection sauvegardée !")
  };

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          {t("collection.title") || "Ma collection Inducks"}
        </CardTitle>
        <CardDescription>
          {t("collection.description") ||
            "Collez ici la liste de vos numéros possédés (un code par ligne, ex: FR/MP 300)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <textarea
          className="flex min-h-[120px] w-full rounded-xl border border-border-subtle bg-surface/50 px-3 py-2 text-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
          placeholder={t("collection.placeholder") || "FR/MP 300^1\nFR/PM 2000^1\nUS/WDC 100^1"}
          value={collectionText}
          onChange={(e) => setCollectionText(e.target.value)}
        />
        {collectionCount > 0 && (
          <div className="text-xs text-text-secondary bg-surface-2/60 p-2 rounded-lg border border-border-subtle">
            {t("collection.saved_count", { count: collectionCount }) ||
              `Vous avez actuellement ${collectionCount} numéros enregistrés.`}
          </div>
        )}
        <div className="mt-auto pt-4">
          <Button onClick={handleSaveCollection} className="w-full gap-2 rounded-xl">
            <Save className="w-4 h-4" />
            {t("collection.save") || "Sauvegarder la collection"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
