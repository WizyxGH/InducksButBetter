import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"
import i18n from '@/i18n'

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
  console.error(err);
  const errMsg = err?.message || "";
  
  if (errMsg.includes("SQL read operations are forbidden") || errMsg.includes("BLOCKED") || errMsg.includes("Quota Exceeded")) {
    window.dispatchEvent(new Event('db-quota-error'));
    toast.error(i18n.t("common.error_quota", "La base de données en ligne est actuellement surchargée. Pour continuer à faire des recherches, veuillez importer la base de données locale (fichiers .isv) dans les paramètres."), {
      duration: 10000,
      action: {
        label: i18n.t("common.go_to_settings", "Aller aux paramètres"),
        onClick: () => {
          window.location.hash = '#/settings';
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
  return `https://flagcdn.com/w20/${code}.png`;
}

