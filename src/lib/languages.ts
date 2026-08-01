import { getLanguageFlagUrl } from "./utils";

/**
 * Master list of all **actively displayed** interface languages.
 *
 * A language should only appear here once its Crowdin translation has
 * reached a meaningful coverage (> 0%). The locale files for all other
 * languages still exist in /public/locales/ so i18next can load them
 * whenever they become available — just add the entry below.
 *
 * Currently active (translated):
 *   fr, en
 *
 * Waiting for Crowdin translators (0% coverage — DO NOT add to UI yet):
 *   de, es, it, pt, nl, da, sv, fi, id
 */
export interface SupportedLanguage {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "fr", name: "Français (FR)", flag: getLanguageFlagUrl("fr") },
  { code: "en", name: "English (US)", flag: getLanguageFlagUrl("en") },
  { code: "de", name: "Deutsch (DE)", flag: getLanguageFlagUrl("de") },
  { code: "es", name: "Español (ES)", flag: getLanguageFlagUrl("es") },
  { code: "it", name: "Italiano (IT)", flag: getLanguageFlagUrl("it") },
  { code: "pt", name: "Português (PT)", flag: getLanguageFlagUrl("pt") },
  // Uncomment each entry once its Crowdin coverage is sufficient:
  // { code: "nl", name: "Nederlands (NL)", flag: getLanguageFlagUrl("nl") },
  // { code: "da", name: "Dansk (DA)", flag: getLanguageFlagUrl("da") },
  // { code: "sv", name: "Svenska (SV)", flag: getLanguageFlagUrl("sv") },
  // { code: "fi", name: "Suomi (FI)", flag: getLanguageFlagUrl("fi") },
  // { code: "id", name: "Indonesia (ID)", flag: getLanguageFlagUrl("id") },
];

/** Fallback language if the browser/stored code is not in the list. */
export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[1]; // "en"

/**
 * Returns the SupportedLanguage entry for the given BCP-47 code,
 * stripping the region subtag (e.g. "en-US" → "en").
 * Falls back to DEFAULT_LANGUAGE when not found.
 */
export function resolveLanguage(bcp47: string): SupportedLanguage {
  const code = (bcp47 || "en").split("-")[0].toLowerCase();
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? DEFAULT_LANGUAGE;
}

