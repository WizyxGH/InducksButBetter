import { executeQuery } from "../db";
import { splitIssueCode, issueCodeKey } from "../issueCode";

/**
 * Resolves an issue whose code may be missing the database's alignment
 * padding — URLs carry `fr/PM 272` while the row stores `fr/PM  272`.
 *
 * Tries the cheapest indexed match first, then the publication/number columns,
 * then a whitespace-insensitive scan as a last resort.
 */
export async function resolveIssue(issuecode: string) {
  const SELECT = `
    SELECT
      i.issuecode,
      i.issuenumber,
      i.publicationcode,
      i.oldestdate,
      i.pages,
      i.price,
      i.size,
      i.attached,
      p.title as publication_title,
      p.countrycode,
      c.countryname
    FROM inducks_issue i
    LEFT JOIN inducks_publication p ON i.publicationcode = p.publicationcode
    LEFT JOIN inducks_country c ON p.countrycode = c.countrycode
  `;

  const exact = await executeQuery({ sql: `${SELECT} WHERE i.issuecode = ?`, args: [issuecode] });
  if (exact.rows.length > 0) return exact.rows[0] as any;

  const { publicationcode, issuenumber } = splitIssueCode(issuecode);
  if (publicationcode && issuenumber) {
    const byColumns = await executeQuery({
      sql: `${SELECT} WHERE i.publicationcode = ? AND i.issuenumber = ? LIMIT 1`,
      args: [publicationcode, issuenumber],
    });
    if (byColumns.rows.length > 0) return byColumns.rows[0] as any;
  }

  // Covers the few unpadded codes whose issue number contains a space, where
  // the publication/number split above lands one character off.
  const loose = await executeQuery({
    sql: `${SELECT} WHERE REPLACE(i.issuecode, ' ', '') = ? LIMIT 1`,
    args: [issueCodeKey(issuecode)],
  });
  return (loose.rows[0] as any) ?? null;
}

export async function getIssueDetail(issuecode: string, lang: string = "fr") {
  const issue = await resolveIssue(issuecode);
  if (!issue) return null;

  // Every follow-up query keys off the canonical, padded code from the row.
  issuecode = issue.issuecode;

  if (!issue.countryname) {
    const country = String(issue.publicationcode || "").split("/")[0];
    issue.countrycode = issue.countrycode || country;
    issue.countryname = country.toUpperCase();
  }

  // 2. Cover / thumbnail
  const thumbResult = await executeQuery({
    sql: `
      SELECT eu.sitecode || '|' || eu.url as issue_thumb
      FROM inducks_entryurl eu
      WHERE eu.entrycode = (
        SELECT entrycode FROM inducks_entry WHERE issuecode = ? ORDER BY position ASC LIMIT 1
      )
    `,
    args: [issuecode]
  });

  const thumb = thumbResult.rows[0]?.issue_thumb || null;

  // 3. Contained stories (index)
  const storiesResult = await executeQuery({
    sql: `
      SELECT
        e.entrycode,
        e.position,
        sv.entirepages,
        sv.kind,
        e.title as entry_title,
        s.storycode,
        s.title as original_title,
        -- How this printing differs from the original story. Inducks shows
        -- these on every entry; they were fetched nowhere before.
        e.entrycomment,
        e.changes,
        e.minorchanges,
        e.cut,
        e.missingpanels,
        e.mirrored,
        e.sideways,
        e.printedcode,
        e.includedinentrycode,
        -- One row per job, deduplicated on the client by person code. Two
        -- plain GROUP_CONCATs listed anyone credited under two roles of the
        -- same bucket twice ("Fabrizio Petrossi, Fabrizio Petrossi" for an
        -- artist credited both 'a' and 'i').
        (SELECT GROUP_CONCAT(sj_c.plotwritartink || ':' || p_c.personcode || '|' || p_c.fullname, ';')
         FROM inducks_storyjob sj_c
         JOIN inducks_person p_c ON sj_c.personcode = p_c.personcode
         WHERE sj_c.storyversioncode = e.storyversioncode) as creators,
        -- Subseries the entry story belongs to, localized name first —
        -- shown as a small link under the title in the table of contents.
        (SELECT ss.subseriescode FROM inducks_storysubseries ss JOIN inducks_subseriesname sn ON ss.subseriescode = sn.subseriescode
         WHERE ss.storycode = s.storycode
         ORDER BY CASE WHEN sn.languagecode = ? THEN 0 ELSE 1 END, sn.preferred DESC LIMIT 1) as subseries_code,
        (SELECT sn.subseriesname FROM inducks_storysubseries ss2 JOIN inducks_subseriesname sn ON ss2.subseriescode = sn.subseriescode
         WHERE ss2.storycode = s.storycode
         ORDER BY CASE WHEN sn.languagecode = ? THEN 0 ELSE 1 END, sn.preferred DESC LIMIT 1) as subseries_name
      FROM inducks_entry e
      LEFT JOIN inducks_storyversion sv ON e.storyversioncode = sv.storyversioncode
      LEFT JOIN inducks_story s ON sv.storycode = s.storycode
      WHERE e.issuecode = ?
      ORDER BY e.position ASC
    `,
    args: [lang, lang, issuecode]
  });

  // Who indexed this issue. `inxtransletcol` is the job column: 'i' is the
  // indexer, the other letters are translator / letterer / colourist.
  const indexersResult = await executeQuery({
    sql: `
      SELECT DISTINCT p.personcode, p.fullname
      FROM inducks_issuejob ij
      JOIN inducks_person p ON ij.personcode = p.personcode
      WHERE ij.issuecode = ? AND ij.inxtransletcol = 'i'
      ORDER BY p.fullname
    `,
    args: [issuecode]
  });

  return {
    ...issue,
    issue_thumb: thumb,
    indexers: indexersResult.rows,
    stories: storiesResult.rows
  };
}
