/**
 * Inducks free-text markup.
 *
 * Comment fields in the Inducks dumps (publicationcomment, subseriescomment,
 * universecomment, issuerangecomment…) embed cross references as pseudo-XML
 * tags whose attribute part is the target code and whose body is the label:
 *
 *   Remplace <publication fr/MPHS>Mickey Parade Géant Hors-Série</publication>
 *   depuis l'arrêt du titre <publication fr/MP>Mickey Parade Géant</publication>
 *
 * The reference site turns each of those into a link (see
 * `programs/coa/util13-nhhtext.php`, `util13_addLinks`). This module does the
 * same, but returns segments instead of HTML so React can render real in-app
 * links without `dangerouslySetInnerHTML`.
 */

import { routes } from "./routes";

/** The tag names Inducks uses, mapped one-to-one onto our own pages. */
export type InducksEntity =
  | "creator"
  | "studio"
  | "hero"
  | "universe"
  | "publication"
  | "issue"
  | "story";

export type InducksTextSegment =
  | { type: "text"; text: string }
  | { type: "link"; entity: InducksEntity; code: string; label: string };

/**
 * `<publication fr/MPHS>Mickey Parade Géant Hors-Série</publication>`
 *
 * Same shape as the upstream PHP regex: the attribute part is everything up to
 * the closing `>`, the label everything up to the closing tag, and the back
 * reference keeps mismatched pairs from being swallowed.
 */
const TAG_PATTERN =
  /<(creator|studio|hero|universe|publication|issue|story)\s+([^>]*)>([^<]*)<\/\1>/g;

/**
 * Splits an Inducks comment into plain-text and cross-reference segments.
 *
 * Text that contains no tag comes back as a single text segment, so callers can
 * always render the result the same way. A tag with an empty code is kept as
 * plain text — there is nothing to link to.
 */
export function parseInducksText(text?: string | null): InducksTextSegment[] {
  if (!text) return [];

  const segments: InducksTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    const entity = match[1] as InducksEntity;
    const code = match[2].trim();
    const label = match[3].trim();

    if (code) {
      segments.push({ type: "link", entity, code, label: label || code });
    } else if (match[3]) {
      segments.push({ type: "text", text: match[3] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }

  return segments;
}

/** True when the text carries at least one cross reference. */
export function hasInducksLinks(text?: string | null): boolean {
  if (!text) return false;
  TAG_PATTERN.lastIndex = 0;
  return TAG_PATTERN.test(text);
}

/**
 * The in-app path a cross reference points at.
 *
 * `studio` shares the creator namespace upstream, and `hero` is what Inducks
 * calls a character.
 */
export function inducksEntityRoute(entity: InducksEntity, code: string): string {
  switch (entity) {
    case "creator":
    case "studio":
      return routes.author(code);
    case "hero":
      return routes.character(code);
    case "universe":
      return routes.universe(code);
    case "publication":
      return routes.publication(code);
    case "issue":
      return routes.issue(code);
    case "story":
      return routes.story(code);
  }
}
