import { executeQuery } from "../db";

// Polyfill for autocomplete queries
export async function autocompleteCharacter(q: string, lang: string = 'fr') {
  if (!q || q.length < 2) return [];
  const result = await executeQuery({
    sql: `
      SELECT c.charactercode, COALESCE(cn.charactername, c.charactername) as charactername,
              (SELECT cu.sitecode || '|' || cu.url
              FROM inducks_characterurl cu
              WHERE cu.charactercode = c.charactercode
              ORDER BY CASE WHEN cu.sitecode = 'webusers' THEN 0 ELSE 1 END
              LIMIT 1) as imageUrl
      FROM inducks_character c
      LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ?
      WHERE (COALESCE(cn.charactername, c.charactername) LIKE ? OR c.charactercode LIKE ?)
      GROUP BY c.charactercode
      ORDER BY MAX(COALESCE(cn.preferred, 0)) DESC, charactername ASC
      LIMIT 10
    `,
    args: [lang, `%${q}%`, `%${q}%`]
  });
  return result.rows;
}

export async function autocompletePerson(q: string) {
  if (!q || q.length < 2) return [];
  const result = await executeQuery({
    sql: `
      SELECT personcode, fullname, nationalitycountrycode, fullname as displayname
      FROM inducks_person
      WHERE fullname LIKE ? OR personcode LIKE ?
      ORDER BY CAST(numberofindexedissues AS INTEGER) DESC, fullname ASC
      LIMIT 10
    `,
    args: [`%${q}%`, `%${q}%`]
  });
  return result.rows;
}

/**
 * Suggests people credited as indexers.
 *
 * There is no `inducks_indexer` table — querying it made every keystroke fail
 * with an SQL error. Indexers are people with an `inducks_issuejob` row whose
 * job column is 'i' ('t', 'l' and 'c' are translator, letterer and colourist).
 * Ordering by issue count puts the prolific indexers first.
 */
export async function autocompleteIndexer(q: string) {
  if (!q || q.length < 2) return [];
  const like = `%${q}%`;
  const result = await executeQuery({
    sql: `
      SELECT p.personcode, p.fullname, p.fullname as displayname
      FROM inducks_issuejob ij
      JOIN inducks_person p ON ij.personcode = p.personcode
      WHERE ij.inxtransletcol = 'i'
        AND (p.fullname LIKE ? OR p.personcode LIKE ?)
      GROUP BY p.personcode
      ORDER BY COUNT(DISTINCT ij.issuecode) DESC, p.fullname ASC
      LIMIT 10
    `,
    args: [like, like]
  });
  return result.rows;
}

export async function autocompleteStorycode(q: string, lang: string = 'fr') {
  if (!q || q.trim().length < 2) return [];
  const qUpper = q.trim().toUpperCase();
  const qUpperEnd = qUpper.slice(0, -1) + String.fromCharCode(qUpper.charCodeAt(qUpper.length - 1) + 1);
  const result = await executeQuery({
    sql: `
      WITH MatchedStories AS (
        SELECT storycode, storyheadercode, title as story_title
        FROM inducks_story
        WHERE storycode >= ? AND storycode < ?
        ORDER BY storycode ASC
        LIMIT 15
      )
      SELECT
        s.storycode as storycode,
        s.storycode as id,
        MAX(COALESCE(s.story_title, sh.title, 'Sans titre')) as storyname,
        (SELECT eu.sitecode || '|' || eu.url
         FROM inducks_storyversion sv_img
         JOIN inducks_entry e_img ON sv_img.storyversioncode = e_img.storyversioncode
         JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
         WHERE sv_img.storycode = s.storycode
           AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
         ORDER BY CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as story_thumb
      FROM MatchedStories s
      LEFT JOIN inducks_storyheader sh ON s.storyheadercode = sh.storyheadercode
      GROUP BY s.storycode
      ORDER BY s.storycode ASC
    `,
    args: [qUpper, qUpperEnd]
  });
  return result.rows;
}

export async function autocompletePublisher(q: string) {
  const like = `%${q}%`;
  const result = await executeQuery({
    sql: `
      SELECT publisherid, publishername
      FROM (
        SELECT publisherid, publishername
        FROM inducks_publisher
        WHERE publishername LIKE ? OR publisherid LIKE ?

        UNION

        SELECT DISTINCT publisherid, publisherid as publishername
        FROM inducks_publishingjob
        WHERE publisherid LIKE ?
      )
      ORDER BY publishername
      LIMIT 10
    `,
    args: [like, like, like]
  });
  return result.rows;
}

export async function autocompletePublicationTitle(q: string) {
  const like = `%${q}%`;
  const result = await executeQuery({
    sql: `
      SELECT DISTINCT p.publicationcode as value, pn.publicationname || ' (' || p.publicationcode || ')' as label
      FROM inducks_publication p
      JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
      WHERE pn.publicationname LIKE ? OR p.publicationcode LIKE ?
      ORDER BY pn.publicationname
      LIMIT 10
    `,
    args: [like, like]
  });
  return result.rows.map((r: any) => ({
    publicationcode: r.value,
    publicationname: r.label
  }));
}

export async function getLocalizedCharacterNames(codes: string[], lang: string = "fr") {
  if (!codes || codes.length === 0) return {};

  const placeholders = codes.map(() => '?').join(',');
  const result = await executeQuery({
    sql: `
      SELECT c.charactercode, COALESCE(cn.charactername, c.charactername) as charactername
      FROM inducks_character c
      LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ? AND cn.preferred = 'Y'
      WHERE c.charactercode IN (${placeholders})
    `,
    args: [lang, ...codes]
  });

  const map: Record<string, string> = {};
  result.rows.forEach((r: any) => {
    map[r.charactercode] = r.charactername;
  });
  return map;
}

export interface UnifiedSearchResult {
  id: string;
  name: string;
  type: "author" | "character" | "publication" | "issue" | "story";
  subtitle?: string | null;
}

export async function unifiedAutocomplete(q: string, lang: string = 'fr'): Promise<UnifiedSearchResult[]> {
  const queryLike = `%${q.trim()}%`;
  const qUpper = q.trim().toUpperCase();
  const qUpperEnd = qUpper.slice(0, -1) + String.fromCharCode(qUpper.charCodeAt(qUpper.length - 1) + 1);

  const [authorsRes, charactersRes, publicationsRes, issuesRes, storiesRes] = await Promise.all([
    // Authors
    executeQuery({
      sql: `
        SELECT personcode as id, fullname as name, 'author' as type
        FROM inducks_person
        WHERE fullname LIKE ? OR personcode LIKE ?
        ORDER BY CAST(numberofindexedissues AS INTEGER) DESC, fullname ASC
        LIMIT 4
      `,
      args: [queryLike, queryLike]
    }).catch(() => ({ rows: [] })),

    // Characters
    executeQuery({
      sql: `
        SELECT c.charactercode as id, COALESCE(cn.charactername, c.charactername) as name, 'character' as type
        FROM inducks_character c
        LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ?
        WHERE c.charactercode LIKE ? OR COALESCE(cn.charactername, c.charactername) LIKE ?
        GROUP BY c.charactercode
        ORDER BY MAX(COALESCE(cn.preferred, 0)) DESC, charactername ASC
        LIMIT 4
      `,
      args: [lang, queryLike, queryLike]
    }).catch(() => ({ rows: [] })),

    // Publications
    executeQuery({
      sql: `
        SELECT p.publicationcode as id, pn.publicationname || ' (' || p.publicationcode || ')' as name, 'publication' as type
        FROM inducks_publication p
        JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
        WHERE p.publicationcode LIKE ? OR pn.publicationname LIKE ?
        GROUP BY p.publicationcode
        ORDER BY MAX(CASE WHEN pn.languagecode = ? THEN 1 ELSE 0 END) DESC, pn.publicationname ASC
        LIMIT 4
      `,
      args: [queryLike, queryLike, lang]
    }).catch(() => ({ rows: [] })),

    // Issues
    executeQuery({
      sql: `
        SELECT i.issuecode as id, pn.publicationname || ' #' || i.issuenumber as name, 'issue' as type, i.title as subtitle
        FROM inducks_issue i
        JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
        WHERE i.issuecode LIKE ? OR i.title LIKE ?
        GROUP BY i.issuecode
        ORDER BY i.oldestdate DESC
        LIMIT 4
      `,
      args: [queryLike, queryLike]
    }).catch(() => ({ rows: [] })),

    // Stories
    executeQuery({
      sql: `
        WITH MatchedStories AS (
          SELECT storycode, title
          FROM inducks_story
          WHERE (storycode >= ? AND storycode < ?) OR title LIKE ?
          ORDER BY storycode ASC
          LIMIT 4
        )
        SELECT storycode as id, storycode as name, 'story' as type, title as subtitle
        FROM MatchedStories
      `,
      args: [qUpper, qUpperEnd, queryLike]
    }).catch(() => ({ rows: [] }))
  ]);

  const combined: UnifiedSearchResult[] = [
    ...(authorsRes.rows || []),
    ...(charactersRes.rows || []),
    ...(publicationsRes.rows || []),
    ...(issuesRes.rows || []),
    ...(storiesRes.rows || [])
  ] as UnifiedSearchResult[];

  return combined;
}
