import { executeQuery } from "../db";
import { pickReferenceVersion } from "../storyVersion";

export async function getStoryDetail(storycode: string, lang: string = "fr") {
  // 1. Core story info
  const coreResult = await executeQuery({
    sql: `
      SELECT s.storycode, s.firstpublicationdate, s.storyheadercode, s.storycomment, s.originalstoryversioncode,
        COALESCE(
          NULLIF(NULLIF(s.title, 'Untitled'), ''),
          (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode WHERE e.storyversioncode = (SELECT MIN(sv2.storyversioncode) FROM inducks_storyversion sv2 WHERE sv2.storycode = s.storycode) AND e.title IS NOT NULL AND e.title != '' AND e.title != 'Untitled' ORDER BY i.oldestdate ASC, e.entrycode ASC LIMIT 1)
        ) as original_title,
        (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode JOIN inducks_publication pub ON i.publicationcode = pub.publicationcode WHERE e.storyversioncode = (SELECT MIN(sv2.storyversioncode) FROM inducks_storyversion sv2 WHERE sv2.storycode = s.storycode) AND e.title IS NOT NULL AND e.title != '' AND pub.languagecode = ? ORDER BY e.entrycode ASC LIMIT 1) as translated_title,
        COALESCE(
          (SELECT sn.subseriesname FROM inducks_storysubseries ss JOIN inducks_subseriesname sn ON ss.subseriescode = sn.subseriescode WHERE ss.storycode = s.storycode ORDER BY CASE WHEN sn.languagecode = ? THEN 0 ELSE 1 END, sn.preferred DESC LIMIT 1),
          (SELECT sh.title FROM inducks_storyheader sh WHERE sh.storyheadercode = s.storyheadercode LIMIT 1)
        ) as series_title,
        -- Same pick order as series_title above, so the code always belongs to
        -- the subseries whose name is displayed (a story can be in several).
        (SELECT ss.subseriescode FROM inducks_storysubseries ss JOIN inducks_subseriesname sn ON ss.subseriescode = sn.subseriescode WHERE ss.storycode = s.storycode ORDER BY CASE WHEN sn.languagecode = ? THEN 0 ELSE 1 END, sn.preferred DESC LIMIT 1) as subseriescode
      FROM inducks_story s
      WHERE s.storycode = ?
    `,
    args: [lang, lang, lang, storycode]
  });

  if (coreResult.rows.length === 0) return null;
  const story = coreResult.rows[0];

  // Get every version, then pick the reference one in JS. Taking
  // MIN(storyversioncode) in SQL showed the wrong kind/pages when a text
  // rendition sorted before the drawn original; the story's own
  // originalstoryversioncode is authoritative when it exists.
  const versionResult = await executeQuery({
    sql: `
      SELECT sv.storyversioncode, sv.kind, sv.entirepages, sv.brokenpagenumerator, sv.brokenpagedenominator, sv.plotsummary, sv.rowsperpage,
        COALESCE(
          (SELECT eu.sitecode || '|' || eu.url
           FROM inducks_entry e_img
           JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
           WHERE e_img.storyversioncode = sv.storyversioncode
             AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
           ORDER BY CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1),
          NULL
        ) as story_thumb
      FROM inducks_storyversion sv
      WHERE sv.storycode = ?
      ORDER BY sv.storyversioncode ASC
    `,
    args: [storycode]
  });

  const version =
    pickReferenceVersion(versionResult.rows as any[], (story as any).originalstoryversioncode) || {};

  // 2. Creators list
  const creatorsResult = await executeQuery({
    sql: `
      SELECT DISTINCT sj.plotwritartink as role, p.personcode, p.fullname
      FROM inducks_storyjob sj
      JOIN inducks_person p ON sj.personcode = p.personcode
      WHERE sj.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
    `,
    args: [storycode]
  });

  // 3. Characters list
  const charactersResult = await executeQuery({
    sql: `
      SELECT DISTINCT app_c.charactercode, COALESCE(cn.charactername, c.charactername) as charactername, app_c.appearancecomment, COALESCE(cn.characternamecomment, c.charactercomment, '') as charactercomment, app_c.number
      FROM inducks_appearance app_c
      JOIN inducks_character c ON app_c.charactercode = c.charactercode
      LEFT JOIN inducks_charactername cn ON app_c.charactercode = cn.charactercode AND cn.languagecode = ? AND cn.preferred = 'Y'
      WHERE app_c.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
      ORDER BY app_c.number ASC
    `,
    args: [lang, storycode]
  });

  // 4. Descriptions in all languages
  const descriptionsResult = await executeQuery({
    sql: `
      SELECT sd.languagecode, sd.desctext
      FROM inducks_storydescription sd
      WHERE sd.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
    `,
    args: [storycode]
  });

  // 5. Publications list
  const publicationsResult = await executeQuery({
    sql: `
      SELECT DISTINCT
        e.entrycode,
        i.issuecode,
        i.issuenumber,
        p.publicationcode,
        p.title as publication_title,
        p.countrycode,
        c.countryname,
        e.position,
        e.title as entry_title,
        i.oldestdate
      FROM inducks_entry e
      JOIN inducks_issue i ON e.issuecode = i.issuecode
      JOIN inducks_publication p ON i.publicationcode = p.publicationcode
      LEFT JOIN inducks_country c ON p.countrycode = c.countrycode
      WHERE e.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
      ORDER BY p.countrycode ASC, i.oldestdate ASC, i.issuecode ASC
    `,
    args: [storycode]
  });

  // 6. Cross-references (XREF)
  const xrefsResult = await executeQuery({
    sql: `
      SELECT r.referencereasonid, r.tostorycode as targetcode, s.title, sv.kind, 'outbound' as direction,
        (SELECT referencereasontext FROM inducks_referencereason WHERE referencereasonid = r.referencereasonid LIMIT 1) as reasontext,
        (SELECT referencereasontranslation FROM inducks_referencereasonname WHERE referencereasonid = r.referencereasonid AND languagecode = ? LIMIT 1) as reasontranslation
      FROM inducks_storyreference r
      JOIN inducks_story s ON s.storycode = r.tostorycode
      LEFT JOIN inducks_storyversion sv ON sv.storyversioncode = s.originalstoryversioncode
      WHERE r.fromstorycode = ?

      UNION

      SELECT r.referencereasonid, r.fromstorycode as targetcode, s.title, sv.kind, 'inbound' as direction,
        (SELECT referencereasontext FROM inducks_referencereason WHERE referencereasonid = r.referencereasonid LIMIT 1) as reasontext,
        (SELECT referencereasontranslation FROM inducks_referencereasonname WHERE referencereasonid = r.referencereasonid AND languagecode = ? LIMIT 1) as reasontranslation
      FROM inducks_storyreference r
      JOIN inducks_story s ON s.storycode = r.fromstorycode
      LEFT JOIN inducks_storyversion sv ON sv.storyversioncode = s.originalstoryversioncode
      WHERE r.tostorycode = ?

      ORDER BY referencereasonid, targetcode
    `,
    args: [lang, storycode, lang, storycode]
  });

  return {
    ...story,
    ...version,
    creators: creatorsResult.rows,
    characters: charactersResult.rows,
    descriptions: descriptionsResult.rows,
    publications: publicationsResult.rows,
    xrefs: xrefsResult.rows
  };
}
