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

// ── Role grouping for the story page ─────────────────────────────────────────

/**
 * Buckets shown on the story page, in display order. `plotwritartink` codes
 * map as: p (plot) and w (script) → script; a (pencils) and i (ink) → art;
 * r → "refers to creator" (an item that merely references the person — the
 * Inducks legend in util35-storyversion.php labels it "refers to creator",
 * it is NOT a redrawing credit).
 */
export type StoryRoleKey = "script" | "art" | "refers_to_creator";

const ROLE_BUCKETS: Record<string, StoryRoleKey> = {
  p: "script",
  w: "script",
  pw: "script",
  a: "art",
  i: "art",
  // Combined codes count for both buckets and are handled explicitly below.
  r: "refers_to_creator",
};

/** Codes that credit the same person as both writer and artist. */
const COMBINED_ROLES: Record<string, StoryRoleKey[]> = {
  pa: ["script", "art"],
  wa: ["script", "art"],
};

const ROLE_ORDER: StoryRoleKey[] = ["script", "art", "refers_to_creator"];

export interface RoleGroup {
  /** i18n suffix: rendered as t(`story.${role}`). */
  role: StoryRoleKey;
  people: Credit[];
}

/**
 * Groups raw storyjob rows into one line per role with deduplicated people.
 *
 * The story page used to group by *person*, so two artists produced two "Art"
 * lines. Grouping by role instead yields a single "Art" line listing both
 * names. A person credited p+w appears once on the script line; unknown role
 * codes are dropped so no raw database code ever reaches the screen.
 */
export function groupCreditsByRole(
  rows: Array<{ role?: string | null; personcode?: string | null; fullname?: string | null }> | null | undefined
): RoleGroup[] {
  const buckets = new Map<StoryRoleKey, Map<string, Credit>>();

  for (const row of rows ?? []) {
    const code = String(row?.personcode ?? "").trim();
    if (!code || PLACEHOLDER_CODES.has(code)) continue;

    const roleCode = String(row?.role ?? "").trim().toLowerCase();
    const targets = COMBINED_ROLES[roleCode] ?? (ROLE_BUCKETS[roleCode] ? [ROLE_BUCKETS[roleCode]] : []);

    for (const target of targets) {
      let bucket = buckets.get(target);
      if (!bucket) {
        bucket = new Map();
        buckets.set(target, bucket);
      }
      if (!bucket.has(code)) {
        bucket.set(code, { code, name: String(row?.fullname ?? "").trim() || code });
      }
    }
  }

  return ROLE_ORDER.filter((role) => buckets.has(role)).map((role) => ({
    role,
    people: Array.from(buckets.get(role)!.values()),
  }));
}
