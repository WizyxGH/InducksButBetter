import { executeQuery } from "../db";

/**
 * The whole subseries catalogue, for the index page.
 *
 * `allnames` carries every language variant so the page can be filtered by a
 * name that is not the one displayed. ~1 200 rows, so it is fetched once and
 * filtered client-side.
 */
export async function getSubseriesList(lang: string = "fr") {
  const result = await executeQuery({
    sql: `
      SELECT s.subseriescode, s.subseriescategory,
        COALESCE(
          (SELECT sn.subseriesname FROM inducks_subseriesname sn
           WHERE sn.subseriescode = s.subseriescode
           ORDER BY CASE WHEN sn.languagecode = ? THEN 0 WHEN sn.languagecode = 'en' THEN 1 ELSE 2 END,
                    sn.preferred DESC LIMIT 1),
          s.subseriesname
        ) as label,
        (SELECT GROUP_CONCAT(sn2.subseriesname, char(10)) FROM inducks_subseriesname sn2
         WHERE sn2.subseriescode = s.subseriescode) as allnames,
        (SELECT COUNT(*) FROM inducks_storysubseries ss WHERE ss.subseriescode = s.subseriescode) as storycount
      FROM inducks_subseries s
      ORDER BY label COLLATE NOCASE ASC
    `,
    args: [lang]
  });
  return result.rows;
}

/**
 * Detail of one subseries: localized name, category, comment, and its story
 * index ordered like subseries.php (publication date, then story code).
 */
export async function getSubseriesDetail(subseriescode: string, lang: string = "fr") {
  const coreResult = await executeQuery({
    sql: `
      SELECT subseriescode, subseriesname, official, subseriescategory, subseriescomment
      FROM inducks_subseries
      WHERE subseriescode = ?
    `,
    args: [subseriescode]
  });
  if (coreResult.rows.length === 0) return null;
  const core = coreResult.rows[0] as any;

  const namesResult = await executeQuery({
    sql: `
      SELECT languagecode, subseriesname, preferred
      FROM inducks_subseriesname
      WHERE subseriescode = ?
      ORDER BY languagecode ASC, preferred DESC
    `,
    args: [subseriescode]
  });

  // Story index. Kind and page count come from the reference version
  // (originalstoryversioncode, falling back to the lowest version code) —
  // the same choice as the story page.
  const storiesResult = await executeQuery({
    sql: `
      SELECT s.storycode,
        COALESCE(
          NULLIF(NULLIF(s.title, 'Untitled'), ''),
          (SELECT e.title FROM inducks_entry e JOIN inducks_storyversion sv2 ON e.storyversioncode = sv2.storyversioncode
           WHERE sv2.storycode = s.storycode AND e.title IS NOT NULL AND e.title != '' AND e.title != 'Untitled'
           ORDER BY e.entrycode ASC LIMIT 1)
        ) as title,
        COALESCE(
          NULLIF(s.firstpublicationdate, ''),
          (SELECT MIN(i_fb.oldestdate) FROM inducks_storyversion sv_fb JOIN inducks_entry e_fb ON sv_fb.storyversioncode = e_fb.storyversioncode JOIN inducks_issue i_fb ON e_fb.issuecode = i_fb.issuecode
           WHERE sv_fb.storycode = s.storycode AND i_fb.oldestdate IS NOT NULL AND i_fb.oldestdate != '')
        ) as firstpublicationdate,
        -- Reference version first (SQLite rejects outer references inside a
        -- scalar subquery ORDER BY, so the fallback is a second subquery).
        COALESCE(
          (SELECT v.kind FROM inducks_storyversion v WHERE v.storyversioncode = s.originalstoryversioncode AND v.storycode = s.storycode),
          (SELECT v.kind FROM inducks_storyversion v WHERE v.storycode = s.storycode ORDER BY v.storyversioncode ASC LIMIT 1)
        ) as kind,
        COALESCE(
          (SELECT v.entirepages FROM inducks_storyversion v WHERE v.storyversioncode = s.originalstoryversioncode AND v.storycode = s.storycode),
          (SELECT v.entirepages FROM inducks_storyversion v WHERE v.storycode = s.storycode ORDER BY v.storyversioncode ASC LIMIT 1)
        ) as entirepages,
        (SELECT eu.sitecode || '|' || eu.url
         FROM inducks_storyversion sv_img
         JOIN inducks_entry e_img ON sv_img.storyversioncode = e_img.storyversioncode
         JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
         WHERE sv_img.storycode = s.storycode
           AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
         ORDER BY CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as story_thumb,
        ss.storysubseriescomment
      FROM inducks_storysubseries ss
      JOIN inducks_story s ON ss.storycode = s.storycode
      WHERE ss.subseriescode = ?
      ORDER BY CASE WHEN s.firstpublicationdate IS NULL OR s.firstpublicationdate = '' THEN '9999' ELSE s.firstpublicationdate END ASC, s.storycode ASC
    `,
    args: [subseriescode]
  });

  return {
    ...core,
    lang,
    names: namesResult.rows,
    stories: storiesResult.rows,
  };
}
