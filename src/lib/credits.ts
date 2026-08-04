/**
 * Parsing of the aggregated credit column produced by the search queries.
 *
 * The database concatenates one entry per job as `role:personcode|fullname`,
 * joined with `;`:
 *
 *     p:TFa|Tito Faraci;w:TFa|Tito Faraci;a:GCa|Giorgio Cavazzano
 *
 * The separator must stay `;` on the SQL side: `GROUP_CONCAT(DISTINCT ...)`
 * ignores its separator argument and always joins with `,`, which used to glue
 * every credit into a single entry and hide the artists.
 */

export interface Credit {
  /** Inducks person code, e.g. `GCa`. */
  code: string;
  /** Display name, e.g. `Giorgio Cavazzano`. */
  name: string;
}

/** Inducks job codes that mean "wrote or plotted this story". */
const WRITER_ROLES = ["p", "w", "pa", "wa", "pw"];

/** Inducks job codes that mean "drew or inked this story". */
const ARTIST_ROLES = ["a", "i", "pa", "wa", "art"];

/** Placeholder person codes Inducks uses for "unknown" and "nobody". */
const PLACEHOLDER_CODES = new Set(["?", "-"]);

function parseEntry(entry: string): Credit | null {
  const separator = entry.indexOf(":");
  if (separator === -1) return null;

  const payload = entry.slice(separator + 1);
  if (!payload) return null;

  const pipe = payload.indexOf("|");
  const code = (pipe === -1 ? payload : payload.slice(0, pipe)).trim();
  const name = (pipe === -1 ? payload : payload.slice(pipe + 1)).trim();

  return code ? { code, name: name || code } : null;
}

function selectRole(entries: string[], roles: string[], keywords: string[]): Credit[] {
  const seen = new Set<string>();
  const out: Credit[] = [];

  for (const entry of entries) {
    const role = entry.slice(0, Math.max(0, entry.indexOf(":"))).toLowerCase();
    const matches = roles.includes(role) || keywords.some((k) => role.includes(k));
    if (!matches) continue;

    const credit = parseEntry(entry);
    // A person credited under two roles (plot + script) must appear once.
    if (!credit || seen.has(credit.code) || PLACEHOLDER_CODES.has(credit.code)) continue;

    seen.add(credit.code);
    out.push(credit);
  }
  return out;
}

export interface StoryCredits {
  writers: Credit[];
  artists: Credit[];
}

/** Splits an aggregated credit string into deduplicated writers and artists. */
export function parseCredits(creators: string | null | undefined): StoryCredits {
  const entries = creators ? String(creators).split(";").filter(Boolean) : [];
  return {
    writers: selectRole(entries, WRITER_ROLES, ["writer", "plot"]),
    artists: selectRole(entries, ARTIST_ROLES, ["penciller", "ink"]),
  };
}
