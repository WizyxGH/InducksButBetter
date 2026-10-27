import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BookmarkCheck, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCollection, formatCollectionExport } from "@/lib/collection";
import { useCollection } from "@/hooks/useCollection";
import { Link } from "@/components/ui/link";
import { routes } from "@/lib/routes";

export function PersonalCollectionCard() {
  const { t } = useTranslation();
  const { issues, count, saveCollection } = useCollection();
  const [collectionText, setCollectionText] = useState("");

  useEffect(() => {
    setCollectionText(formatCollectionExport(issues));
  }, [issues]);

  const handleSaveCollection = () => {
    const parsed = parseCollection(collectionText);
    saveCollection(parsed);
    setCollectionText(formatCollectionExport(parsed));
    toast.success(t("collection.saved_success"));
  };

  return (
    <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm flex flex-col h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookmarkCheck className="w-4 h-4 text-primary" />
            {t("collection.title")}
          </CardTitle>
          <Link
            to={routes.collection()}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
          >
            <span>{t("collection.open_full_page")}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <CardDescription>
          {t("collection.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <textarea
          className="flex min-h-[120px] w-full rounded-xl border border-border-subtle bg-surface/50 px-3 py-2 text-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
          placeholder={t("collection.placeholder")}
          value={collectionText}
          onChange={(e) => setCollectionText(e.target.value)}
        />
        {count > 0 && (
          <div className="text-xs text-text-secondary bg-surface-2/60 p-2 rounded-lg border border-border-subtle flex items-center justify-between">
            <span>{t("collection.saved_count", { count })}</span>
            <Link
              to={routes.collection()}
              className="text-primary hover:underline font-semibold"
            >
              {t("collection.view_stats")}
            </Link>
          </div>
        )}
        <div className="mt-auto pt-4 flex gap-2">
          <Button onClick={handleSaveCollection} className="flex-1 gap-2 rounded-xl">
            <Save className="w-4 h-4" />
            {t("collection.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
