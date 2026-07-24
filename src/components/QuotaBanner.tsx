import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { hasLocalDb } from "@/lib/localDb";
import { executeQuery } from "@/lib/db";

interface QuotaBannerProps {
  onGoToSettings: () => void;
}

export function QuotaBanner({ onGoToSettings }: QuotaBannerProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleQuotaError = () => {
      if (!hasLocalDb()) {
        setIsVisible(true);
      }
    };

    const handleLocalDbLoaded = () => {
      setIsVisible(false);
    };

    window.addEventListener("db-quota-error", handleQuotaError);
    window.addEventListener("db-local-loaded", handleLocalDbLoaded);

    // Ping the database on load to show the banner proactively if it's already overloaded.
    // Cache the status in sessionStorage to only query once per visit (session).
    if (!hasLocalDb()) {
      const cachedQuotaStatus = sessionStorage.getItem("db_quota_status");
      if (cachedQuotaStatus === "failed") {
        setIsVisible(true);
      } else if (!cachedQuotaStatus) {
        executeQuery("SELECT 1 FROM inducks_country LIMIT 1")
          .then(() => {
            sessionStorage.setItem("db_quota_status", "ok");
          })
          .catch(err => {
            const errMsg = err?.message || "";
            if (
              errMsg.includes("SQL read operations are forbidden") ||
              errMsg.includes("BLOCKED") ||
              errMsg.includes("Quota Exceeded")
            ) {
              sessionStorage.setItem("db_quota_status", "failed");
              setIsVisible(true);
            }
          });
      }
    }

    return () => {
      window.removeEventListener("db-quota-error", handleQuotaError);
      window.removeEventListener("db-local-loaded", handleLocalDbLoaded);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="bg-red-500/10 text-red-600 dark:text-red-400 border-b border-red-500/20 px-4 lg:px-12 py-2.5 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 transition-all">
      <div className="flex items-start sm:items-center gap-2.5 font-medium leading-relaxed">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
        <span>{t("common.quota_banner", "La base de données en ligne est surchargée. Veuillez importer la base de données locale dans les paramètres pour continuer sans limites.")}</span>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onGoToSettings} 
        className="border-red-500/30 hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 text-red-600 dark:text-red-400 w-full sm:w-auto shrink-0 h-8 text-xs font-semibold"
      >
        {t("common.go_to_settings", "Aller aux paramètres")}
      </Button>
    </div>
  );
}
