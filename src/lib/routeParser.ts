/**
 * Centralized Route Path Parser for InducksButBetter
 * 
 * Parses raw URL path segments (e.g. /stories/W+US+242-01, /countries/de/LTB/613, /stories/issue/us/US/+242)
 * into a structured tab and entity codes object.
 */

export interface ParsedRoute {
  tab: string;
  storycode?: string;
  issuecode?: string;
  personcode?: string;
  charactercode?: string;
  countrycode?: string;
  publicationcode?: string;
  publisherid?: string;
  indexercode?: string;
  subseriescode?: string;
  universecode?: string;
}

/**
 * Parses a relative path string into an application route object.
 *
 * @param pathPart The path segment of the URL (e.g. "stories/issue/us/US/242")
 * @returns ParsedRoute object specifying tab and active entity codes
 */
export function parseRoutePath(pathPart: string): ParsedRoute {
  const parts = pathPart.split("/").filter(Boolean);
  if (parts.length === 0) return { tab: "home" };

  const root = parts[0];

  if (root === "home") return { tab: "home" };
  if (root === "settings") return { tab: "settings" };
  if (root === "sql") return { tab: "sql" };
  if (root === "suggestions") return { tab: "suggestions" };

  // Handle /issue/us/US/242 or /issues/...
  if (root === "issue" || root === "issues") {
    const code = parts.length >= 4 
      ? `${parts[1]}/${parts[2]} ${parts.slice(3).join("/")}` 
      : parts.slice(1).join("/");
    return { tab: "publications", issuecode: code.trim() };
  }

  // Handle /author/Carl Barks or /authors/...
  if (root === "author" || root === "authors") {
    return { tab: "authors", personcode: parts.slice(1).join("/") };
  }

  // Handle /character/Donald or /characters/...
  if (root === "character" || root === "characters") {
    return { tab: "characters", charactercode: parts.slice(1).join("/") };
  }

  // Handle /indexer/FGe or /indexers/... — indexers catalogue issues, so they
  // live alongside publications rather than under authors.
  if (root === "indexer" || root === "indexers") {
    return { tab: "publications", indexercode: parts.slice(1).join("/") };
  }

  // Handle /subseries/<code> — subseries group stories, so they live in the
  // stories tab. The code may itself contain '/' once decoded, so everything
  // after the root is joined back together.
  if (root === "subseries") {
    // Bare /subseries is the catalogue of every subseries, its own tab.
    const code = parts.slice(1).join("/");
    return code ? { tab: "stories", subseriescode: code } : { tab: "subseries" };
  }

  // Handle /universes and /universes/<code> — universes gather characters, so
  // a universe page lives in the characters tab; the catalogue is its own.
  if (root === "universes" || root === "universe") {
    const code = parts.slice(1).join("/");
    return code ? { tab: "characters", universecode: code } : { tab: "universes" };
  }

  // Handle /publisher/D or /publishers/...
  if (root === "publisher" || root === "publishers") {
    return { tab: "publications", publisherid: parts.slice(1).join("/") };
  }

  // Handle /stories or /entries or /story
  if (root === "stories" || root === "entries" || root === "story") {
    if (parts[1] === "issue" || parts[1] === "issues") {
      const code = parts.length >= 5
        ? `${parts[2]}/${parts[3]} ${parts.slice(4).join("/")}`
        : parts.slice(2).join("/");
      return { tab: "publications", issuecode: code.trim() };
    }
    if (parts[1] === "story" && parts[2]) {
      return { tab: "stories", storycode: parts.slice(2).join("/") };
    }
    if (parts[1] && parts[1] !== "story") {
      return { tab: "stories", storycode: parts.slice(1).join("/") };
    }
    return { tab: "stories" };
  }

  // Handle /countries or /publications or /publication
  if (root === "countries" || root === "publications" || root === "publication") {
    if (parts[1] === "issue" || parts[1] === "issues") {
      const code = parts.length >= 5
        ? `${parts[2]}/${parts[3]} ${parts.slice(4).join("/")}`
        : parts.slice(2).join("/");
      return { tab: "publications", issuecode: code.trim() };
    }
    if (parts.length >= 4) {
      const issueCode = `${parts[1]}/${parts[2]} ${parts.slice(3).join("/")}`;
      return { tab: "publications", issuecode: issueCode.trim() };
    }
    if (parts.length === 3) {
      return { tab: "publications", publicationcode: `${parts[1]}/${parts[2]}` };
    }
    if (parts.length === 2 && root === "countries") {
      return { tab: "countries", countrycode: parts[1] };
    }
    if (root === "countries") {
      return { tab: "countries" };
    }
    return { tab: "publications" };
  }

  return { tab: "stories" };
}
