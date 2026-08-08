/**
 * Tokenizer for the Inducks keyword filter.
 *
 * `inducks_storyversion.keywordsummary` stores space-separated words with the
 * stop words already removed: the real value for "à travers les siècles" is
 * " noël travers les siècles " — the "à" is gone. Matching the raw phrase
 * therefore finds nothing; the query must AND one LIKE per meaningful word.
 * This module mirrors that normalisation on the input side.
 */

/**
 * Small French/English stop-word list. It only needs to cover what users
 * naturally type in a phrase; anything of 2 characters or less is dropped
 * anyway by the length rule.
 */
const STOPWORDS = new Set([
  // French
  "les", "une", "des", "aux", "est", "son", "ses", "leur", "leurs",
  "dans", "avec", "pour", "par", "sur", "que", "qui", "pas", "mais",
  // English
  "the", "and", "for", "with", "his", "her", "its", "their", "are", "was",
  "not", "but", "from", "into", "onto",
]);

/** Removes combining accents: "siècles" → "siecles". */
export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Splits a free-text keyword query into the words worth matching.
 *
 * Lowercases, splits on anything that is not a letter/digit, then drops
 * words of 2 characters or less and stop words (checked on both the accented
 * and unaccented forms). "à travers les siècles" → ["travers", "siècles"].
 */
export function tokenizeKeywords(input: string | null | undefined): string[] {
  if (!input) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of String(input).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const word = raw.trim();
    if (word.length <= 2) continue;
    if (STOPWORDS.has(word) || STOPWORDS.has(stripAccents(word))) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }

  return out;
}

/**
 * SQL fragments for one keyword: the accented form, plus the unaccented
 * variant when it differs (SQLite's LIKE is only case-insensitive for ASCII,
 * and the database mixes both spellings).
 */
export function keywordLikeVariants(word: string): string[] {
  const plain = stripAccents(word);
  return plain !== word ? [word, plain] : [word];
}
