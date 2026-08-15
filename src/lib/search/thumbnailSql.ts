/**
 * Shared SQL for Inducks thumbnails.
 *
 * Every image URL in the database is assembled the same way — a row in
 * `inducks_entryurl` gives a site code and a path, and `inducks_site` turns the
 * site code into a base URL. These fragments existed as nine hand-copied
 * variants across eight files, which is how `issue_thumb` came to read the
 * wrong table for years without anyone noticing the others already read the
 * right one.
 *
 * The emitted value is always `"sitecode|url"`, the contract
 * `components/ResultCard/thumbUrl.ts` parses.
 */

/** The column expression every thumbnail subquery selects. */
const THUMB_VALUE = "eu.sitecode || '|' || eu.url";

/**
 * Site codes holding page scans.
 *
 * `inducks_site` flags 41 sites as image hosts, but story thumbnails
 * deliberately draw on the scan mirrors only — the per-country trees hold
 * material of uneven provenance.
 */
const SCAN_SITECODES = "('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')";

/** Full-size upload first, then the thumbnail mirrors, then anything else. */
const SITE_PREFERENCE = `CASE
    WHEN eu.sitecode = 'webusers' THEN 0
    WHEN eu.sitecode LIKE 'thumbnails%' THEN 1
    ELSE 2 END`;

/**
 * Cover of an issue: page 1, from a site `inducks_site` marks as hosting images.
 *
 * `issuecodeExpr` is interpolated, not bound — pass a column reference such as
 * `i.issuecode`, or the literal `?` to bind at the call site. Never pass user
 * input.
 */
export function coverThumbSql(issuecodeExpr: string): string {
  return `(SELECT ${THUMB_VALUE}
     FROM inducks_entry e_cover
     JOIN inducks_entryurl eu ON e_cover.entrycode = eu.entrycode
     JOIN inducks_site st ON eu.sitecode = st.sitecode
    WHERE e_cover.issuecode = ${issuecodeExpr}
      AND st.images = 'Y'
      AND eu.pagenumber = '1'
    ORDER BY CASE WHEN e_cover.position = 'a' THEN 0 WHEN e_cover.position = 'c' THEN 1 ELSE 2 END, ${SITE_PREFERENCE}
    LIMIT 1)`;
}

/** First available scan for a story, reached through any of its versions. */
export function storyThumbByStorycodeSql(storycodeExpr: string): string {
  return `(SELECT ${THUMB_VALUE}
     FROM inducks_storyversion sv_img
     JOIN inducks_entry e_img ON sv_img.storyversioncode = e_img.storyversioncode
     JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
    WHERE sv_img.storycode = ${storycodeExpr}
      AND eu.sitecode IN ${SCAN_SITECODES}
    ORDER BY ${SITE_PREFERENCE}
    LIMIT 1)`;
}

/**
 * Portrait of a character, from `inducks_characterurl`.
 *
 * A different source table from the scans above, but the same emitted contract,
 * so `thumbUrl.ts` resolves it identically.
 *
 * NOTE: as of the August 2026 dump this table ships empty — `inducks_characterurl.isv`
 * contains its header row and nothing else — so every call currently resolves to
 * NULL. Character portraits come from `characterThumb()` in lib/imageProxy.ts,
 * which asks inducks.org/characterthumb.php directly. Kept because the column is
 * populated again whenever upstream republishes it.
 */
export function characterImageSql(charactercodeExpr: string): string {
  return `(SELECT cu.sitecode || '|' || cu.url
     FROM inducks_characterurl cu
    WHERE cu.charactercode = ${charactercodeExpr}
    ORDER BY CASE WHEN cu.sitecode = 'webusers' THEN 0 ELSE 1 END
    LIMIT 1)`;
}

/** First available scan for one specific version of a story. */
export function storyThumbByVersionSql(versioncodeExpr: string): string {
  return `(SELECT ${THUMB_VALUE}
     FROM inducks_entry e_img
     JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
    WHERE e_img.storyversioncode = ${versioncodeExpr}
      AND eu.sitecode IN ${SCAN_SITECODES}
    ORDER BY ${SITE_PREFERENCE}
    LIMIT 1)`;
}
