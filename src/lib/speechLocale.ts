/**
 * Map an i18next UI language to a BCP-47 tag for the Web Speech APIs.
 *
 * Speech recognition and synthesis were hard-wired to fr-FR / en-US, so users
 * of the nine other UI languages dictated and heard English. Unknown languages
 * still fall back to en-US.
 */
const SPEECH_LOCALES: Record<string, string> = {
  da: "da-DK",
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  fi: "fi-FI",
  fr: "fr-FR",
  id: "id-ID",
  it: "it-IT",
  nl: "nl-NL",
  pt: "pt-BR",
  sv: "sv-SE",
}

export function speechLocale(language: string | undefined): string {
  if (!language) return "en-US"
  if (SPEECH_LOCALES[language]) return SPEECH_LOCALES[language]
  const base = language.split(/[-_]/)[0].toLowerCase()
  return SPEECH_LOCALES[base] ?? "en-US"
}
