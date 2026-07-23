import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

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
    toast.error("La base de données distante est surchargée (quota atteint). Veuillez importer la base de données locale dans les paramètres pour continuer sans limite.", { duration: 10000 });
  } else {
    toast.error(customMessage || "Erreur lors de la récupération des données.");
  }
}

export function getFlagUrl(countryCode: string): string {
  if (!countryCode) return "";
  let code = countryCode.toLowerCase().trim();
  const map: Record<string, string> = {
    uk: "gb",
    en: "gb",
    sf: "fi",
  };
  code = map[code] || code;
  return `https://flagcdn.com/w20/${code}.png`;
}

