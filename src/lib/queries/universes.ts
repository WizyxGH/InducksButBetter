import { executeQuery } from "../db";

/**
 * The whole universe catalogue, for the index page. 163 rows, fetched once.
 *
 * `inducks_universe` holds no name, so the label comes from
 * `inducks_universename` (UI language, then English) and falls back to the
 * code — the order universe.php uses.
 */
export async function getUniverseList(lang: string = "fr") {
  const result = await executeQuery({
    sql: `
      SELECT u.universecode,
        COALESCE(
          (SELECT un.universename FROM inducks_universename un
           WHERE un.universecode = u.universecode AND un.languagecode IN (?, 'en')
           ORDER BY CASE WHEN un.languagecode = ? THEN 0 ELSE 1 END LIMIT 1),
          u.universecode
        ) as label,
        (SELECT GROUP_CONCAT(un2.universename, char(10)) FROM inducks_universename un2
         WHERE un2.universecode = u.universecode) as allnames,
        (SELECT COUNT(*) FROM inducks_ucrelation ucr WHERE ucr.universecode = u.universecode) as charactercount
      FROM inducks_universe u
      ORDER BY label COLLATE NOCASE ASC
    `,
    args: [lang, lang]
  });
  return result.rows;
}

/**
 * A universe and the characters that belong to it, ordered by localized name
 * like universe.php.
 */
export async function getUniverseDetail(universecode: string, lang: string = "fr") {
  const coreResult = await executeQuery({
    sql: `SELECT universecode, universecomment FROM inducks_universe WHERE universecode = ?`,
    args: [universecode]
  });
  if (coreResult.rows.length === 0) return null;

  const namesResult = await executeQuery({
    sql: `
      SELECT languagecode, universename
      FROM inducks_universename
      WHERE universecode = ? AND universename != ''
      ORDER BY languagecode ASC
    `,
    args: [universecode]
  });

  const charactersResult = await executeQuery({
    sql: `
      SELECT c.charactercode,
        COALESCE(NULLIF(cn.charactername, ''), c.charactername) as charactername,
        c.charactername as originalcharactername,
        c.charactercomment,
        (SELECT cu.sitecode || '|' || cu.url FROM inducks_characterurl cu
         WHERE cu.charactercode = c.charactercode
         ORDER BY CASE WHEN cu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as imageUrl
      FROM inducks_character c
      JOIN inducks_ucrelation ucr ON ucr.charactercode = c.charactercode
      LEFT JOIN inducks_charactername cn
        ON cn.charactercode = c.charactercode AND cn.languagecode = ? AND cn.preferred = 'Y'
      WHERE ucr.universecode = ?
      ORDER BY charactername COLLATE NOCASE ASC
    `,
    args: [lang, universecode]
  });

  return {
    ...coreResult.rows[0],
    names: namesResult.rows,
    characters: charactersResult.rows,
  };
}
