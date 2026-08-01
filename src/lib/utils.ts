import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"
import i18n from '@/i18n'
import { navigate } from "@/lib/navigation";

let internalHistoryCount = 0;

export function incrementHistoryCount() {
  internalHistoryCount++;
}

export function navigateBack(fallback: () => void) {
  if (internalHistoryCount > 1 || window.history.length > 2) {
    window.history.back();
  } else {
    fallback();
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function handleDbError(err: any, customMessage?: string) {
  const errMsg = err?.message || "";
  
  if (errMsg.includes("SQL read operations are forbidden") || errMsg.includes("BLOCKED") || errMsg.includes("Quota Exceeded")) {
    window.dispatchEvent(new Event('db-quota-error'));
    toast.error(i18n.t("common.error_quota", "veuillez importer la base de données locale (fichiers .isv) dans les paramètres."), {
      duration: 10000,
      action: {
        label: i18n.t("common.go_to_settings", "Aller aux paramètres"),
        onClick: () => {
          navigate('#/settings');
        }
      }
    });
  } else {
    toast.error(customMessage || i18n.t("common.error", "Une erreur est survenue"));
  }
}

export function getFlagUrl(countryCode: string): string {
  if (!countryCode) return "";
  let code = countryCode.toLowerCase().trim();
  if (code === "yu") {
    return "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Flag_of_Yugoslavia_%281946-1992%29.svg/20px-Flag_of_Yugoslavia_%281946-1992%29.svg.png";
  }
  const map: Record<string, string> = {
    uk: "gb",
    en: "gb",
    sf: "fi",
  };
  code = map[code] || code;
  return `https://flagcdn.com/w80/${code}.png`;
}

export function getLanguageFlagUrl(languageCode: string): string {
  if (!languageCode) return "";
  const code = languageCode.toLowerCase().trim().split("-")[0];
  const map: Record<string, string> = {
    en: "us",
    fr: "fr",
    de: "de",
    es: "es",
    it: "it",
    pt: "pt",
    nl: "nl",
    da: "dk",
    sv: "se",
    fi: "fi",
    id: "id",
  };
  const resolvedCode = map[code] || code;
  return resolvedCode === "gb" || resolvedCode === "fr" || resolvedCode === "de" || resolvedCode === "es" || resolvedCode === "it" || resolvedCode === "pt" || resolvedCode === "nl" || resolvedCode === "dk" || resolvedCode === "se" || resolvedCode === "fi" || resolvedCode === "id"
    ? `https://flagcdn.com/w80/${resolvedCode}.png`
    : `https://flagcdn.com/w80/${resolvedCode}.png`;
}

export function hasInducksCookie(): boolean {
  return !!localStorage.getItem("inducks_cookie");
}

export function cleanComment(comment?: string): string {
  if (!comment) return "";
  // Remove brackets [ ] and leading/trailing quotes " "
  let cleaned = comment.replace(/[\[\]]/g, "").replace(/^"|"$/g, "").trim();
  // Remove space before commas
  return cleaned.replace(/\s+,\s*/g, ", ");
}

export function cleanPublisherName(name?: string): string {
  if (!name) return "";
  // Remove space before commas, replace multiple spaces/commas neatly
  return name.replace(/\s+,\s*/g, ", ").trim();
}

export function isInvalidPlotsummary(text?: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  
  // Checks if the text is empty or is a typical list of credits/indexing codes (e.g. ,JGi, or Art: Barks)
  const isCodeList = /^,\s*[a-zA-Z0-9_\s]+,\s*$/.test(trimmed) || trimmed === "," || /^,\s*[a-zA-Z0-9_\s]+$/.test(trimmed);
  const isCreditHeader = /^(Art|Script|Plot|Des|Desenhos|Roteiro|Ink|Pencils|Pencil|Inks|Colors|Letters|Texte|Dessin|Scénario|Scenario|Translation|Aut|Dis)\s*:/i.test(trimmed);
  
  return isCodeList || isCreditHeader || trimmed.length <= 5;
}

/**
 * Port of Inducks official util05_treatPubdate (from programs/coa/util05-date.php)
 * Handles UTC timezone to avoid date shifts, quarters (YYYY-Q1), decades (1940s),
 * trailing '?' (unsure), and partial dates (YYYY-MM-00 / YYYY-00-00 / -mm-dd).
 */
export function formatInducksDate(dateStr: string | null | undefined, lang: string = 'fr'): string {
  if (!dateStr || dateStr.trim() === '' || dateStr.startsWith('9') || dateStr === '0000-00-00') {
    return '?';
  }

  let text = dateStr.trim();
  let isUnsure = false;

  if (text.endsWith('?')) {
    isUnsure = true;
    text = text.slice(0, -1).trim();
  }

  // Decades (e.g. 1940s)
  const decadeMatch = text.match(/^([12][890][0-9]0)s$/i);
  if (decadeMatch) {
    const decade = decadeMatch[1];
    const formattedDecade = i18n.t('dates.decades', { decade, defaultValue: lang === 'fr' ? `années ${decade}` : `${decade}s` });
    return isUnsure ? `${formattedDecade} (?)` : formattedDecade;
  }

  // Clean -mm-dd and -mm
  text = text.replace(/-mm-dd/gi, '').replace(/-mm/gi, '');

  // Quarters (e.g. 1950-Q1)
  const quarterMatch = text.match(/^([0-9]{4})-Q([1-4])/i);
  if (quarterMatch) {
    const year = quarterMatch[1];
    const q = quarterMatch[2];
    const qKey = `dates.quarter_${q}`;
    const fallbackStr = lang === 'fr' ? `${q}e trimestre ${year}` : `Quarter ${q}, ${year}`;
    const qStr = i18n.t(qKey, { year, defaultValue: fallbackStr });
    return isUnsure ? `${qStr} (?)` : qStr;
  }

  // Match YYYY-MM-DD or YYYY-MM-00 or YYYY-00-00
  const parts = text.split('-');
  if (parts.length >= 1) {
    const year = parts[0];
    const month = parts[1] && parts[1] !== '00' ? parts[1] : null;
    const day = parts[2] && parts[2] !== '00' ? parts[2] : null;

    if (!month) {
      return isUnsure ? `${year} (?)` : year;
    }

    try {
      const yNum = parseInt(year, 10);
      const mNum = parseInt(month, 10) - 1;
      const dNum = day ? parseInt(day, 10) : 1;

      // Construct date in UTC to prevent timezone shifts
      const date = new Date(Date.UTC(yNum, mNum, dNum));

      if (isNaN(date.getTime())) {
        return isUnsure ? `${text} (?)` : text;
      }

      const locale = lang === 'en' ? 'en-US' : 'fr-FR';
      
      if (!day) {
        const formatted = new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'long',
          timeZone: 'UTC'
        }).format(date);
        return isUnsure ? `${formatted} (?)` : formatted;
      }

      const formatted = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(date);
      return isUnsure ? `${formatted} (?)` : formatted;
    } catch {
      return isUnsure ? `${text} (?)` : text;
    }
  }

  return isUnsure ? `${text} (?)` : text;
}

