
import { SearchFilters, PublicationsSearchFilters, SearchQueryResponse, StorycodeCandidate } from './types';

export function getStorycodeCandidates(code: string): StorycodeCandidate[] {
  let h = code.trim();
  h = h.replace(/\s+/g, ' ');

  const candidates: string[] = [h];

  // Heuristics matching Inducks COA util14-storycode.php
  let heuristic = h;
  
  // 1. Normalize common publication prefix aliases
  heuristic = heuristic.replace(/^w?\s?us\s/i, "W US "); // e.g. "US 1" -> "W US 1"
  heuristic = heuristic.replace(/^w?\s?os\s/i, "W OS "); // e.g. "OS 1" -> "W OS 1"
  heuristic = heuristic.replace(/^w?\s?wdcs/i, "W WDC ");
  heuristic = heuristic.replace(/^w?\s?dda/i, "W OS ");
  
  heuristic = heuristic.replace(/\s+/g, ' ');
  
  // 2. Map old Dell Giant (W US) codes to their corresponding W OS issue number
  heuristic = heuristic.replace(/^w us\s?1[ a-z-]*$/i, "W OS 386");
  heuristic = heuristic.replace(/^w us\s?2[ a-z-]*$/i, "W OS 456");
  heuristic = heuristic.replace(/^w us\s?3[ a-z-]*$/i, "W OS 495");
  
  // 3. Remove trailing publication indicator suffix: W ([a-z ]+ [0-9]+)( |-)[a-z]+ -> W \1
  const wMatch = heuristic.match(/^w ([a-z ]+\s?[0-9]+)(?: |-)[a-z]+/i);
  if (wMatch) {
    heuristic = "W " + wMatch[1];
  }
  
  // 4. Ensure space between country prefix and issue number: ^(.)([0-9]) -> \1 \2
  heuristic = heuristic.replace(/^([a-z])([0-9])/i, "$1 $2");
  
  // 5. Map Italian Topolino series prefix: ^j -> I
  heuristic = heuristic.replace(/^j\s/i, "I ");
  
  // 6. Strip leading zeros from issue numbers
  heuristic = heuristic.replace(/^([hs]\s.*\s)0+/i, "$1");
  heuristic = heuristic.replace(/^(w\s.*[a-z].*\s)0+/i, "$1");
  
  // 7. Normalize French PM (Parade du Journal de Mickey) and strip parts suffixes
  heuristic = heuristic.replace(/f\s?pm/i, "F PM");
  heuristic = heuristic.replace(/^(f\s[a-z]{2}\s[0-9]{5})[acde]/i, "$1");
  
  // 8. Italian Topolino shortcut: "I 123" or "I T 123" -> "I TL 123"
  if (/^I [0-9]/i.test(heuristic)) {
    heuristic = heuristic.replace(/^I\s/i, "I TL ");
  }
  if (/^I T\s/i.test(heuristic)) {
    heuristic = heuristic.replace(/^I T\s/i, "I TL ");
  }
  
  // 9. Dutch Donald Duck weekly (H) date format conversions
  if (/^H ([0-9]{4})$/i.test(heuristic)) {
    const digits = heuristic.substring(2);
    heuristic = "H " + digits[0] + digits[1] + "0" + digits[2] + digits[3];
  }
  
  heuristic = heuristic.replace(/^W FC/i, "W OS");
  heuristic = heuristic.replace(/^([A-Za-z]+)-/i, "$1 ");
  
  // 10. Dutch HJR / HLN to H code conversions (e.g. HJR 1984 -> H 19084)
  const hjr4Match = heuristic.match(/^HJR ([0-9]{4})$/i);
  if (hjr4Match) {
    heuristic = "H " + hjr4Match[1].substring(0, 2) + "0" + hjr4Match[1].substring(2);
  } else {
    const hjr5Match = heuristic.match(/^HJR ([0-9]{5})$/i);
    if (hjr5Match) {
      heuristic = "H " + hjr5Match[1];
    } else {
      const hln4Match = heuristic.match(/^HLN ([0-9]{4})$/i);
      if (hln4Match) {
        heuristic = "H " + hln4Match[1].substring(0, 2) + "0" + hln4Match[1].substring(2);
      } else {
        const hln5Match = heuristic.match(/^HLN ([0-9]{5})$/i);
        if (hln5Match) {
          heuristic = "H " + hln5Match[1];
        }
      }
    }
  }
  
  heuristic = heuristic.replace(/^HJR\s/i, "H ");
  heuristic = heuristic.replace(/^HLN\s/i, "H ");
  heuristic = heuristic.replace(/^W M\s?M\s?O\s?S/i, "W OS");
  heuristic = heuristic.replace(/^W D\s?D\s?O\s?S/i, "W OS");
  
  heuristic = heuristic.replace(/^IS\s/i, "I ");
  heuristic = heuristic.replace(/^WM\s/i, "W ");
  heuristic = heuristic.replace(/^wdc/i, "W WDC");

  if (heuristic !== h) {
    candidates.push(heuristic);
  }


  // Pack the candidates: remove all whitespace, convert to lowercase, and strip special chars
  const seen = new Set<string>();
  const out: StorycodeCandidate[] = [];

  for (const c of candidates) {
    const packed = c.replace(/\s+/g, '').toLowerCase().replace(/[^a-z0-9\-]/g, '');
    if (!seen.has(packed)) {
      seen.add(packed);
      out.push({ unpacked: c, packed });
    }
  }

  return out;
}

export function buildAdvancedSearchQuery(filters: SearchFilters): SearchQueryResponse {
  const pageSize = Math.max(1, parseInt(String(filters.rowsperpage || "24"), 10) || 24);
  const page = Math.max(1, parseInt(String(filters.page || "1"), 10) || 1);
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const svWhere: string[] = [];
  const whereParams: any[] = [];
  const svWhereParams: any[] = [];
  const lang = filters.lang || "fr";

  if (filters.storycode) {
    const code = filters.storycode.trim();
    
    // Check if we should do a basic prefix search or a smart search
    let inducksCodesOnly = false;
    if (code.length === 1 || (code.length <= 3 && (/^X/i.test(code) || /^[a-zA-Z]C/i.test(code)))) {
      inducksCodesOnly = true;
    }

    if (inducksCodesOnly) {
      const prefix = code.toUpperCase();
      const prefixEnd = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
      where.push("s.storycode >= ? AND s.storycode < ?");
      whereParams.push(prefix, prefixEnd);

      const stripped = prefix.replace(/\s+/g, '');
      where.push("REPLACE(s.storycode, ' ', '') LIKE ?");
      whereParams.push(stripped + '%');
    } else {
      const candidates = getStorycodeCandidates(code);
      if (candidates.length > 0) {
        const rangeClauses: string[] = [];
        const likeClauses: string[] = [];
        
        for (const cand of candidates) {
          const parts = cand.unpacked.split(/\s+/).filter(Boolean);
          if (parts.length > 0) {
            const prefixParts = parts.slice(0, 2);
            const prefix = prefixParts.join(' ').toUpperCase();
            const prefixEnd = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
            
            rangeClauses.push("(s.storycode >= ? AND s.storycode < ?)");
            whereParams.push(prefix, prefixEnd);
          }
          
          likeClauses.push("REPLACE(s.storycode, ' ', '') LIKE ?");
          whereParams.push(cand.packed + '%');
        }
        
        if (rangeClauses.length > 0) {
          where.push("(" + rangeClauses.join(" OR ") + ")");
        }
        if (likeClauses.length > 0) {
          where.push("(" + likeClauses.join(" OR ") + ")");
        }
      }
    }
  }

  if (filters.title) {
    where.push("(s.storyheadercode IN (SELECT sh.storyheadercode FROM inducks_storyheader sh WHERE sh.title LIKE ?) OR s.storycode IN (SELECT sv_t.storycode FROM inducks_entry e_t JOIN inducks_storyversion sv_t ON e_t.storyversioncode = sv_t.storyversioncode WHERE e_t.title LIKE ?))");
    whereParams.push(`%${filters.title}%`, `%${filters.title}%`);
  }

  if (filters.description) {
    let descClause = "(sv.plotsummary LIKE ? OR EXISTS (SELECT 1 FROM inducks_storydescription sd WHERE sd.storyversioncode = sv.storyversioncode AND sd.desctext LIKE ?))";
    svWhereParams.push(`%${filters.description}%`, `%${filters.description}%`);
    if (filters.includeComments === "true" || filters.includeComments === true) {
      descClause = "(sv.plotsummary LIKE ? OR s.storycomment LIKE ? OR EXISTS (SELECT 1 FROM inducks_storydescription sd WHERE sd.storyversioncode = sv.storyversioncode AND sd.desctext LIKE ?))";
      // We need to insert s.storycomment in whereParams, but it's part of svWhere? 
      // Wait, s.storycomment is on s, which is available inside the EXISTS (SELECT 1 FROM inducks_storyversion sv ... WHERE sv.storycode = s.storycode)
      // So svWhereParams is fine! BUT WAIT, we popped the two we just pushed?
      svWhereParams.pop();
      svWhereParams.pop();
      svWhereParams.push(`%${filters.description}%`, `%${filters.description}%`, `%${filters.description}%`);
    }
    svWhere.push(descClause);
  }

  if (filters.kind !== undefined && filters.kind !== null) {
    const kinds = (Array.isArray(filters.kind) ? filters.kind : String(filters.kind).split(",")).map(k => k.trim());
    if (kinds.length > 0) {
      // Inducks uses 'n' for "Histoire" (which is technically narrative text story).
      // Standard comic stories have no kind (NULL or empty string). 
      // If the user selects "Histoire" ('n'), we should also include empty kinds.
      const hasN = kinds.includes("n");
      const hasEmpty = kinds.includes("") || hasN;
      const otherKinds = kinds.filter(k => k !== "");
      
      let clauses = [];
      if (hasEmpty) {
        clauses.push("(sv.kind = '' OR sv.kind IS NULL)");
      }
      if (otherKinds.length > 0) {
        clauses.push(`sv.kind IN (${otherKinds.map(() => "?").join(",")})`);
        svWhereParams.push(...otherKinds);
      }
      if (clauses.length > 0) {
        svWhere.push(`(${clauses.join(" OR ")})`);
      }
    }
  }

  if (filters.charactercode) {
    const codes = (Array.isArray(filters.charactercode) ? filters.charactercode : String(filters.charactercode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      codes.forEach(code => {
        where.push(`s.storycode IN (SELECT sv_c.storycode FROM inducks_storyversion sv_c JOIN inducks_appearance app_c ON sv_c.storyversioncode = app_c.storyversioncode WHERE app_c.charactercode COLLATE NOCASE = ?)`);
        whereParams.push(code);
      });
    }
  }

  if (filters.herocode) {
    const codes = (Array.isArray(filters.herocode) ? filters.herocode : String(filters.herocode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      codes.forEach(code => {
        where.push(`s.storycode IN (SELECT sv_h.storycode FROM inducks_storyversion sv_h JOIN inducks_appearance app_h ON sv_h.storyversioncode = app_h.storyversioncode WHERE app_h.charactercode COLLATE NOCASE = ? AND app_h.number = 0)`);
        whereParams.push(code);
      });
    }
  }

  if (filters.excludeCharactercode) {
    const codes = (Array.isArray(filters.excludeCharactercode) ? filters.excludeCharactercode : String(filters.excludeCharactercode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      svWhere.push(`NOT EXISTS (SELECT 1 FROM inducks_appearance app_ex WHERE app_ex.storyversioncode = sv.storyversioncode AND app_ex.charactercode COLLATE NOCASE IN (${codes.map(() => "?").join(",")}))`);
      svWhereParams.push(...codes);
    }
  }

  if (filters.universes && Array.isArray(filters.universes)) {
    const universes = filters.universes.filter(u => u && String(u).trim());
    if (universes.length > 0) {
      where.push(`s.storycode IN (SELECT sv_u.storycode FROM inducks_storyversion sv_u JOIN inducks_appearance app_u ON sv_u.storyversioncode = app_u.storyversioncode JOIN inducks_ucrelation ucr ON app_u.charactercode = ucr.charactercode WHERE app_u.number = 0 AND ucr.universecode IN (${universes.map(() => "?").join(",")}))`);
      whereParams.push(...universes);
    }
  }

  if (filters.noOtherCharacters === true || String(filters.noOtherCharacters) === "true") {
    const selectedCharCodes = [
      ...(Array.isArray(filters.charactercode || []) ? (filters.charactercode || []) : String(filters.charactercode || "").split(",")),
      ...(Array.isArray(filters.herocode || []) ? (filters.herocode || []) : String(filters.herocode || "").split(","))
    ].map(c => c.trim()).filter(Boolean);
    const distinctSelectedCount = new Set(selectedCharCodes).size;
    if (distinctSelectedCount > 0) {
      where.push(`s.storycode IN (SELECT sv_no.storycode FROM inducks_storyversion sv_no WHERE (SELECT COUNT(DISTINCT charactercode) FROM inducks_appearance app_count WHERE app_count.storyversioncode = sv_no.storyversioncode) = ?)`);
      whereParams.push(distinctSelectedCount);
    }
  }

  if (filters.personRoles && Array.isArray(filters.personRoles)) {
    const roles = filters.personRoles.filter(pr => pr.code && String(pr.code).trim());
    if (roles.length > 0) {
      roles.forEach(pr => {
        let roleCondition = "";
        if (pr.role && pr.role !== 'any') {
          roleCondition = `AND sj.plotwritartink LIKE '%${pr.role}%'`;
        }
        svWhere.push(`sv.storyversioncode IN (SELECT sj.storyversioncode FROM inducks_storyjob sj WHERE sj.personcode = ? ${roleCondition})`);
        svWhereParams.push(pr.code.trim());
      });
    }
  }

  if (filters.excludePersoncode) {
    const codes = (Array.isArray(filters.excludePersoncode) ? filters.excludePersoncode : String(filters.excludePersoncode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      svWhere.push(`sv.storyversioncode NOT IN (SELECT sj_ex.storyversioncode FROM inducks_storyjob sj_ex WHERE sj_ex.personcode IN (${codes.map(() => "?").join(",")}))`);
      svWhereParams.push(...codes);
    }
  }

  if (filters.nationality) {
    const nationalities = (Array.isArray(filters.nationality) ? filters.nationality : String(filters.nationality).split(",")).map(n => n.trim()).filter(Boolean);
    if (nationalities.length > 0) {
      svWhere.push(`EXISTS (SELECT 1 FROM inducks_storyjob sj_n JOIN inducks_person p_n ON sj_n.personcode = p_n.personcode WHERE sj_n.storyversioncode = sv.storyversioncode AND p_n.nationalitycountrycode IN (${nationalities.map(() => "?").join(",")}))`);
      svWhereParams.push(...nationalities);
    }
  }

  if (filters.publisherid) {
    svWhere.push(`EXISTS (SELECT 1 FROM inducks_publishingjob pjob WHERE pjob.storyversioncode = sv.storyversioncode AND pjob.publisherid = ?)`);
    svWhereParams.push(filters.publisherid);
  }

  if (filters.country || filters.language) {
    const countries = (Array.isArray(filters.country) ? filters.country : [filters.country || ""]).filter(Boolean);
    const languages = (Array.isArray(filters.language) ? filters.language : [filters.language || ""]).filter(Boolean);

    if (countries.length > 0 || languages.length > 0) {
      if (countries.length > 0) {
        const actualCountries = countries.filter(c => c !== 'UNPUBLISHED');
        const hasUnpublished = countries.includes('UNPUBLISHED');

        const parts = [];
        if (actualCountries.length > 0) {
          parts.push(`EXISTS (SELECT 1 FROM inducks_entry e_c JOIN inducks_issue i_c ON e_c.issuecode = i_c.issuecode JOIN inducks_publication p_c ON i_c.publicationcode = p_c.publicationcode WHERE e_c.storyversioncode = sv.storyversioncode AND p_c.countrycode IN (${actualCountries.map(() => "?").join(",")}))`);
          svWhereParams.push(...actualCountries);
        }
        if (hasUnpublished) {
          parts.push(`NOT EXISTS (SELECT 1 FROM inducks_entry e_unpub WHERE e_unpub.storyversioncode = sv.storyversioncode)`);
        }

        if (parts.length > 0) {
          svWhere.push(`(${parts.join(" OR ")})`);
        }
      }
      if (languages.length > 0) {
        svWhere.push(`EXISTS (SELECT 1 FROM inducks_entry e_l JOIN inducks_issue i_l ON e_l.issuecode = i_l.issuecode JOIN inducks_publication p_l ON i_l.publicationcode = p_l.publicationcode WHERE e_l.storyversioncode = sv.storyversioncode AND p_l.languagecode IN (${languages.map(() => "?").join(",")}))`);
        svWhereParams.push(...languages);
      }
    }
  }

  if (filters.hasImage && filters.hasImage !== 'all') {
    const existsClause = `EXISTS (SELECT 1 FROM inducks_entry e_img JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode WHERE e_img.storyversioncode = sv.storyversioncode AND eu.url IS NOT NULL AND eu.url != '' AND eu.sitecode IN ('webusers', 'thumbnails'))`;
    if (filters.hasImage === 'yes') {
      svWhere.push(existsClause);
    } else if (filters.hasImage === 'no') {
      svWhere.push(`NOT ${existsClause}`);
    }
  }

  if (filters.pagesExact) {
    svWhere.push("sv.entirepages = ?");
    svWhereParams.push(parseInt(String(filters.pagesExact), 10));
  } else {
    if (filters.pagesMin) { svWhere.push("sv.entirepages >= ?"); svWhereParams.push(parseInt(String(filters.pagesMin), 10)); }
    if (filters.pagesMax) { svWhere.push("sv.entirepages <= ?"); svWhereParams.push(parseInt(String(filters.pagesMax), 10)); }
  }

  // Removed the '1920' hardcoded limit as it breaks empty dates

  const hasDateAfter = !!filters.dateAfter;
  const hasDateBefore = !!filters.dateBefore;

  if (hasDateAfter || hasDateBefore) {
    const mainDateConds = [];
    const issueDateConds = [];
    const issueDateSubquery = `(SELECT MIN(i_d.oldestdate) FROM inducks_storyversion sv_d JOIN inducks_entry e_d ON sv_d.storyversioncode = e_d.storyversioncode JOIN inducks_issue i_d ON e_d.issuecode = i_d.issuecode WHERE sv_d.storycode = s.storycode)`;
    
    if (hasDateAfter) {
      const da = filters.dateAfter!.trim();
      let daParam = da;
      if (daParam.endsWith('-01-01')) daParam = daParam.substring(0, 4);
      mainDateConds.push("s.firstpublicationdate >= ?");
      issueDateConds.push(`${issueDateSubquery} >= ?`);
      whereParams.push(daParam);
    }
    
    if (hasDateBefore) {
      const db = filters.dateBefore!.trim();
      let dbParam = db;
      if (dbParam.endsWith('-12-31')) dbParam = dbParam.substring(0, 4) + '-99-99';
      mainDateConds.push("s.firstpublicationdate <= ?");
      issueDateConds.push(`${issueDateSubquery} <= ?`);
      whereParams.push(dbParam);
    }

    where.push(`((s.firstpublicationdate != '' AND ${mainDateConds.join(" AND ")}) OR ((s.firstpublicationdate = '' OR s.firstpublicationdate IS NULL) AND ${issueDateConds.join(" AND ")}))`);
    
    if (hasDateAfter) {
      const da = filters.dateAfter!.trim();
      let daParam = da;
      if (daParam.endsWith('-01-01')) daParam = daParam.substring(0, 4);
      whereParams.push(daParam);
    }
    if (hasDateBefore) {
      const db = filters.dateBefore!.trim();
      let dbParam = db;
      if (dbParam.endsWith('-12-31')) dbParam = dbParam.substring(0, 4) + '-99-99';
      whereParams.push(dbParam);
    }
  }

  if (filters.stripsperpage && filters.stripsperpage !== 'all') {
    svWhere.push("sv.rowsperpage = ?");
    svWhereParams.push(parseInt(String(filters.stripsperpage), 10));
  }
  if (filters.panelsperstrip && filters.panelsperstrip !== 'all') {
    svWhere.push("sv.columnsperpage = ?");
    svWhereParams.push(parseInt(String(filters.panelsperstrip), 10));
  }

  if (filters.indexingIncomplete === "true" || filters.indexingIncomplete === true) {
    where.push(`(s.storycode NOT IN (SELECT sv_i.storycode FROM inducks_storyversion sv_i JOIN inducks_appearance app_i ON sv_i.storyversioncode = app_i.storyversioncode) OR s.storycode IN (SELECT sv_i.storycode FROM inducks_storyversion sv_i JOIN inducks_appearance app_i ON sv_i.storyversioncode = app_i.storyversioncode WHERE app_i.charactercode = '?'))`);
  }

  if (filters.multipleParts === "true" || filters.multipleParts === true) {
    svWhere.push(`EXISTS (SELECT 1 FROM inducks_entry e_p WHERE e_p.storyversioncode = sv.storyversioncode AND e_p.part IS NOT NULL AND e_p.part != '')`);
  }

  if (filters.subseriescode) {
    const codes = (Array.isArray(filters.subseriescode) ? filters.subseriescode : String(filters.subseriescode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      where.push(`s.storycode IN (SELECT ss.storycode FROM inducks_storysubseries ss WHERE ss.subseriescode IN (${codes.map(() => "?").join(",")}))`);
      whereParams.push(...codes);
    }
  }

  if (svWhere.length > 0) {
    where.push(`s.storycode IN (SELECT sv.storycode FROM inducks_storyversion sv WHERE ${svWhere.join(" AND ")})`);
  }

  const p: any[] = [...whereParams, ...svWhereParams];

  if (filters.onlyCollection) {
    try {
      const saved = localStorage.getItem("inducks_collection_issues");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        where.push(`s.storycode IN (SELECT c_sv.storycode FROM inducks_entry c_entry JOIN inducks_storyversion c_sv ON c_entry.storyversioncode = c_sv.storyversioncode WHERE c_entry.issuecode IN (SELECT value FROM json_each(?)))`);
        p.push(JSON.stringify(parsed));
      } else {
        where.push("1 = 0");
      }
    } catch (e) {
      where.push("1 = 0");
    }
  }

  const sort = String(filters.sort || "pubdate_desc");
  let orderBy = "NULLIF(s.firstpublicationdate, '') DESC NULLS LAST, s.storycode ASC";
  let sortJoins = "";
  
  const isPreciseStorycodeSearch = filters.storycode && String(filters.storycode).trim().split(/\s+/).length >= 2;
  
  if (sort === "pubdate_asc") {
    orderBy = "NULLIF(s.firstpublicationdate, '') ASC NULLS LAST, s.storycode ASC";
  } else if (sort === "title_az") {
    sortJoins = "LEFT JOIN inducks_storyheader sh_sort ON s.storyheadercode = sh_sort.storyheadercode";
    orderBy = "sh_sort.title ASC, s.storycode ASC";
  } else if (sort === "title_za") {
    sortJoins = "LEFT JOIN inducks_storyheader sh_sort ON s.storyheadercode = sh_sort.storyheadercode";
    orderBy = "sh_sort.title DESC, s.storycode ASC";
  } else if (sort === "pages_desc") {
    orderBy = "(SELECT MAX(entirepages) FROM inducks_storyversion WHERE storycode = s.storycode) DESC, s.storycode ASC";
  } else if (sort === "pages_asc") {
    orderBy = "(SELECT MIN(entirepages) FROM inducks_storyversion WHERE storycode = s.storycode) ASC, s.storycode ASC";
  } else if (sort === "published_most") {
    orderBy = "(SELECT COUNT(e_sort.entrycode) FROM inducks_entry e_sort JOIN inducks_storyversion sv_sort ON e_sort.storyversioncode = sv_sort.storyversioncode WHERE sv_sort.storycode = s.storycode) DESC, s.storycode ASC";
  } else if (sort === "published_least") {
    orderBy = "(SELECT COUNT(e_sort.entrycode) FROM inducks_entry e_sort JOIN inducks_storyversion sv_sort ON e_sort.storyversioncode = sv_sort.storyversioncode WHERE sv_sort.storycode = s.storycode) ASC, s.storycode ASC";
  } else if (sort === "pubdate_desc" && isPreciseStorycodeSearch) {
    // Optimization: if searching for a precise storycode, order by length to prioritize exact matches
    orderBy = "LENGTH(s.storycode) ASC, s.storycode ASC";
  }

  const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
  const countQuery = `SELECT COUNT(s.storycode) as total FROM inducks_story s ${whereSql}`;

  const mainQuery = `
    WITH StoryIds AS (
      SELECT s.storycode, s.firstpublicationdate, s.storyheadercode, s.storycomment, s.title
      FROM inducks_story s
      ${sortJoins}
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    ),
    BestVersions AS (
      SELECT sv.storyversioncode, sv.storycode, sv.kind, sv.entirepages, sv.brokenpagenumerator, sv.brokenpagedenominator, sv.plotsummary, sv.rowsperpage, sv.columnsperpage
      FROM inducks_storyversion sv
      WHERE sv.storyversioncode IN (
        SELECT MIN(v.storyversioncode) FROM inducks_storyversion v JOIN StoryIds ids ON v.storycode = ids.storycode ${svWhere.length > 0 ? "WHERE " + svWhere.join(" AND ").replace(/sv\./g, 'v.') : ""} GROUP BY v.storycode
      )
    )
    SELECT s.storycode,
      COALESCE(
        (SELECT sn.subseriesname FROM inducks_storysubseries ss JOIN inducks_subseriesname sn ON ss.subseriescode = sn.subseriescode WHERE ss.storycode = s.storycode ORDER BY CASE WHEN sn.languagecode = ? THEN 0 ELSE 1 END, sn.preferred DESC LIMIT 1),
        (SELECT sh.title FROM inducks_storyheader sh WHERE sh.storyheadercode = s.storyheadercode LIMIT 1)
      ) as series_title,
      COALESCE(
        NULLIF(s.firstpublicationdate, ''),
        (SELECT MIN(i_fb.oldestdate) FROM inducks_storyversion sv_fb JOIN inducks_entry e_fb ON sv_fb.storyversioncode = e_fb.storyversioncode JOIN inducks_issue i_fb ON e_fb.issuecode = i_fb.issuecode WHERE sv_fb.storycode = s.storycode)
      ) as firstpublicationdate, sv.kind, sv.entirepages, sv.brokenpagenumerator, sv.brokenpagedenominator, sv.plotsummary, s.storycomment,
      COALESCE(
        NULLIF(NULLIF(s.title, 'Untitled'), ''),
        (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode WHERE e.storyversioncode = sv.storyversioncode AND e.title IS NOT NULL AND e.title != '' AND e.title != 'Untitled' ORDER BY i.oldestdate ASC, e.entrycode ASC LIMIT 1)
      ) as original_title,
      (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode JOIN inducks_publication pub ON i.publicationcode = pub.publicationcode WHERE e.storyversioncode = sv.storyversioncode AND e.title IS NOT NULL AND e.title != '' AND pub.languagecode = ? ORDER BY e.entrycode ASC LIMIT 1) as translated_title,
      COALESCE(
        (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode JOIN inducks_publication pub ON i.publicationcode = pub.publicationcode WHERE e.storyversioncode = sv.storyversioncode AND e.title IS NOT NULL AND e.title != '' ORDER BY CASE WHEN pub.languagecode = ? THEN 0 ELSE 1 END, e.entrycode ASC LIMIT 1),
        s.title,
        NULL
      ) as story_title,
      COALESCE(
        (SELECT eu.sitecode || '|' || eu.url
         FROM inducks_entry e_img
         JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
         JOIN inducks_issue i_img ON e_img.issuecode = i_img.issuecode
         LEFT JOIN inducks_publication p_img ON i_img.publicationcode = p_img.publicationcode
         WHERE e_img.storyversioncode = sv.storyversioncode
           AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
         ORDER BY
           CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END,
           COALESCE(i_img.oldestdate, '9999-99-99') ASC,
           CASE WHEN p_img.languagecode = ? THEN 0 ELSE 1 END
         LIMIT 1),
        (SELECT eu.sitecode || '|' || eu.url
         FROM inducks_entry e_img
         JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
         JOIN inducks_issue i_img ON e_img.issuecode = i_img.issuecode
         WHERE e_img.storyversioncode = sv.storyversioncode
           AND sv.kind = 'c'
           AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
         ORDER BY
           CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END,
           COALESCE(i_img.oldestdate, '9999-99-99') ASC
         LIMIT 1)
      ) as story_thumb,
      COALESCE(
        (SELECT CASE
           WHEN TRIM(sd.desctext) LIKE 'Art:%' OR TRIM(sd.desctext) LIKE 'Script:%' OR TRIM(sd.desctext) LIKE 'Plot:%' OR TRIM(sd.desctext) LIKE 'Des:%' OR TRIM(sd.desctext) LIKE 'Desenhos:%' OR TRIM(sd.desctext) LIKE 'Roteiro:%'
                OR TRIM(sd.desctext) LIKE 'Ink:%' OR TRIM(sd.desctext) LIKE 'Pencils:%' OR TRIM(sd.desctext) LIKE 'Pencil:%' OR TRIM(sd.desctext) LIKE 'Inks:%' OR TRIM(sd.desctext) LIKE 'Colors:%'
                OR TRIM(sd.desctext) LIKE 'Letters:%' OR TRIM(sd.desctext) LIKE 'Texte:%' OR TRIM(sd.desctext) LIKE 'Dessin:%' OR TRIM(sd.desctext) LIKE 'Scénario:%'
                OR TRIM(sd.desctext) LIKE 'Scenario:%' OR TRIM(sd.desctext) LIKE 'Translation:%' OR TRIM(sd.desctext) LIKE 'Aut:%' OR TRIM(sd.desctext) LIKE 'Dis:%'
                OR TRIM(sd.desctext) LIKE ',%' OR TRIM(sd.desctext) LIKE '%.%'
           THEN NULL
           ELSE sd.desctext
         END FROM inducks_storydescription sd 
         WHERE sd.storyversioncode = sv.storyversioncode 
         ORDER BY 
           CASE 
             WHEN sd.languagecode = ? THEN 0 
             WHEN sd.languagecode = 'en' THEN 1 
             ELSE 2 
           END ASC,
           sd.desctext ASC
         LIMIT 1),
        (SELECT CASE
           WHEN TRIM(sv.plotsummary) LIKE 'Art:%' OR TRIM(sv.plotsummary) LIKE 'Script:%' OR TRIM(sv.plotsummary) LIKE 'Plot:%' OR TRIM(sv.plotsummary) LIKE 'Des:%' OR TRIM(sv.plotsummary) LIKE 'Desenhos:%' OR TRIM(sv.plotsummary) LIKE 'Roteiro:%'
                OR TRIM(sv.plotsummary) LIKE 'Ink:%' OR TRIM(sv.plotsummary) LIKE 'Pencils:%' OR TRIM(sv.plotsummary) LIKE 'Pencil:%' OR TRIM(sv.plotsummary) LIKE 'Inks:%' OR TRIM(sv.plotsummary) LIKE 'Colors:%'
                OR TRIM(sv.plotsummary) LIKE 'Letters:%' OR TRIM(sv.plotsummary) LIKE 'Texte:%' OR TRIM(sv.plotsummary) LIKE 'Dessin:%' OR TRIM(sv.plotsummary) LIKE 'Scénario:%'
                OR TRIM(sv.plotsummary) LIKE 'Scenario:%' OR TRIM(sv.plotsummary) LIKE 'Translation:%' OR TRIM(sv.plotsummary) LIKE 'Aut:%' OR TRIM(sv.plotsummary) LIKE 'Dis:%'
                OR TRIM(sv.plotsummary) LIKE ',%'
           THEN NULL
           ELSE sv.plotsummary
         END)
      ) as full_description,
      (SELECT GROUP_CONCAT(DISTINCT sj.plotwritartink || ':' || p.personcode || '|' || p.fullname) 
       FROM inducks_storyjob sj 
       JOIN inducks_person p ON sj.personcode = p.personcode 
       WHERE sj.storyversioncode = sv.storyversioncode) as creators,
      (SELECT GROUP_CONCAT(app_c.charactercode || '|' || COALESCE(cn.charactername, c.charactername) || '|' || COALESCE(app_c.appearancecomment, '') || '|' || COALESCE(cn.characternamecomment, c.charactercomment, '') || '|' || COALESCE((SELECT url FROM inducks_characterurl cu WHERE cu.charactercode = app_c.charactercode LIMIT 1), ''), ';')
       FROM (SELECT charactercode, appearancecomment, number FROM inducks_appearance WHERE storyversioncode = sv.storyversioncode ORDER BY number ASC) app_c
       JOIN inducks_character c ON app_c.charactercode = c.charactercode
       LEFT JOIN inducks_charactername cn ON app_c.charactercode = cn.charactercode AND cn.languagecode = ? AND cn.preferred = 'Y'
      ) as character_list,
      (SELECT GROUP_CONCAT(DISTINCT p_c.countrycode || '|' || p_c.title || '|' || i_c.issuenumber) 
       FROM inducks_entry e_c 
       JOIN inducks_storyversion sv_c ON e_c.storyversioncode = sv_c.storyversioncode
       JOIN inducks_issue i_c ON e_c.issuecode = i_c.issuecode 
       JOIN inducks_publication p_c ON i_c.publicationcode = p_c.publicationcode 
       WHERE sv_c.storycode = s.storycode) as publication_list,
      (SELECT app_h.charactercode 
       FROM inducks_appearance app_h 
       WHERE app_h.storyversioncode = sv.storyversioncode AND app_h.number = 0 
       ORDER BY app_h.charactercode ASC LIMIT 1) as hero_code,
      (SELECT COALESCE((SELECT cn_h.charactername FROM inducks_charactername cn_h WHERE cn_h.charactercode = app_h.charactercode AND cn_h.languagecode = ? AND cn_h.preferred = 'Y' LIMIT 1), c_h.charactername)
       FROM inducks_appearance app_h 
       JOIN inducks_character c_h ON app_h.charactercode = c_h.charactercode 
       WHERE app_h.storyversioncode = sv.storyversioncode AND app_h.number = 0 
       ORDER BY app_h.charactercode ASC LIMIT 1) as hero_name,
      sv.rowsperpage, sv.columnsperpage
    FROM StoryIds ids
    JOIN inducks_story s ON ids.storycode = s.storycode
    JOIN BestVersions sv ON s.storycode = sv.storycode
    ORDER BY ${orderBy}
  `;

  return { query: mainQuery, countQuery, params: [...p, pageSize, offset, ...svWhereParams, lang, lang, lang, lang, lang, lang, lang], countParams: p, pageSize, page };
}

export function buildPublicationsSearchQuery(filters: PublicationsSearchFilters): SearchQueryResponse {
  const pageSize = Math.max(1, parseInt(String(filters.rowsperpage || "24"), 10) || 24);
  const page = Math.max(1, parseInt(String(filters.page || "1"), 10) || 1);
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const p: any[] = [];

  if (filters.country) {
    where.push("p.countrycode = ?");
    p.push(filters.country);
  }

  if (filters.category) {
    where.push("EXISTS (SELECT 1 FROM inducks_publicationcategory pc WHERE pc.publicationcode = p.publicationcode AND pc.category = ?)");
    p.push(filters.category);
  }

  if (filters.title) {
    const like = `%${filters.title.trim()}%`;
    where.push("(pn.publicationname LIKE ? OR i.title LIKE ? OR p.publicationcode LIKE ?)");
    p.push(like, like, like);
  }

  if (filters.issuenumber) {
    where.push("i.issuenumber = ?");
    p.push(filters.issuenumber.trim());
  }

  if (filters.dateAfter || filters.dateBefore) {
    where.push("SUBSTR(i.oldestdate, 1, 4) > '1920'");
  }

  if (filters.dateAfter) {
    const da = filters.dateAfter!.trim();
    if (/^\d{4}$/.test(da)) {
      where.push("SUBSTR(i.oldestdate, 1, 4) >= ?");
      p.push(da);
    } else {
      let daParam = da;
      if (daParam.endsWith('-01-01')) {
        daParam = daParam.substring(0, 4);
      }
      where.push("i.oldestdate >= ?");
      p.push(daParam);
    }
  }

  if (filters.dateBefore) {
    const db = filters.dateBefore!.trim();
    if (/^\d{4}$/.test(db)) {
      where.push("SUBSTR(i.oldestdate, 1, 4) <= ?");
      p.push(db);
    } else {
      let dbParam = db;
      if (dbParam.endsWith('-12-31')) {
        dbParam = dbParam.substring(0, 4) + '-99-99';
      }
      where.push("i.oldestdate <= ?");
      p.push(dbParam);
    }
  }

  if (filters.publisherid) {
    where.push(`EXISTS (
      SELECT 1 FROM inducks_publishingjob pj 
      WHERE pj.issuecode = i.issuecode AND pj.publisherid = ?
    )`);
    p.push(filters.publisherid.trim());
  }

  if (filters.indexer) {
    const like = `%${filters.indexer.trim()}%`;
    where.push(`EXISTS (
      SELECT 1 FROM inducks_issuejob ij 
      JOIN inducks_person per ON ij.personcode = per.personcode 
      WHERE ij.issuecode = i.issuecode AND ij.inxtransletcol = 'i' AND per.fullname LIKE ?
    )`);
    p.push(like);
  }

  if (filters.collects === true || filters.collects === "true") {
    where.push(`EXISTS (
      SELECT 1 FROM inducks_issuecollecting ic 
      WHERE ic.collectingissuecode = i.issuecode
    )`);
  }

  if (filters.specificTitle) {
    where.push("i.title LIKE ?");
    p.push(`%${filters.specificTitle.trim()}%`);
  }

  if (filters.pages !== undefined) {
    where.push("i.pages = ?");
    p.push(filters.pages);
  }

  if (filters.price) {
    where.push("i.price LIKE ?");
    p.push(`%${filters.price.trim()}%`);
  }

  if (filters.attached) {
    where.push("i.attached LIKE ?");
    p.push(`%${filters.attached.trim()}%`);
  }

  if (filters.size) {
    where.push("i.size LIKE ?");
    p.push(`%${filters.size.trim()}%`);
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  let orderBy = "p.countrycode ASC, i.issuecode ASC";
  const sort = filters.sort || "country_code";
  if (sort === "date_asc") {
    orderBy = "i.oldestdate ASC, i.issuecode ASC";
  } else if (sort === "date_desc") {
    orderBy = "i.oldestdate DESC, i.issuecode ASC";
  } else if (sort === "pages_asc") {
    orderBy = "i.pages ASC, i.issuecode ASC";
  } else if (sort === "pages_desc") {
    orderBy = "i.pages DESC, i.issuecode ASC";
  }

  const countQuery = `
    SELECT COUNT(*) as total
    FROM inducks_issue i
    JOIN inducks_publication p ON i.publicationcode = p.publicationcode
    LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
    ${whereClause}
  `;

  const mainQuery = `
    WITH MatchedIssues AS (
      SELECT i.issuecode
      FROM inducks_issue i
      JOIN inducks_publication p ON i.publicationcode = p.publicationcode
      LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    )
    SELECT 
      i.issuecode, 
      i.issuenumber, 
      i.title as issue_title, 
      i.pages, 
      i.price, 
      i.attached, 
      i.size, 
      i.oldestdate,
      p.publicationcode, 
      p.countrycode, 
      p.languagecode, 
      pn.publicationname as series_title,
      (SELECT iu.sitecode || '|' || iu.url 
       FROM inducks_issueurl iu 
       WHERE iu.issuecode = i.issuecode 
       ORDER BY CASE WHEN iu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as issue_thumb,
      (SELECT pub.publishername 
       FROM inducks_publishingjob pj 
       JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid 
       WHERE pj.issuecode = i.issuecode LIMIT 1) as publishername
    FROM MatchedIssues mi
    JOIN inducks_issue i ON mi.issuecode = i.issuecode
    JOIN inducks_publication p ON i.publicationcode = p.publicationcode
    LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
    ORDER BY ${orderBy}
  `;

  return { 
    query: mainQuery, 
    countQuery, 
    params: [...p, pageSize, offset], 
    countParams: p, 
    pageSize, 
    page 
  };
}

