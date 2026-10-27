import { executeQuery } from "../db";

export interface CollectionPublicationStat {
  publicationcode: string;
  publication_title: string;
  countrycode: string;
  countryname: string;
  total_issues: number;
  owned_issues: number;
  missing_issues: number;
  percentage: number;
}

export interface PublicationIssueItem {
  issuecode: string;
  issuenumber: string;
  issuerangecode: string | null;
  issue_title: string | null;
  oldestdate: string | null;
}

/**
 * Calculates collection completeness per publication across all countries.
 * Uses SQLite's json_each to execute in a single high-performance query.
 */
export async function getCollectionPublicationStats(
  issues: string[]
): Promise<CollectionPublicationStat[]> {
  if (!issues || issues.length === 0) {
    return [];
  }

  const jsonIssues = JSON.stringify(issues);

  const sql = `
    WITH user_coll AS (
      SELECT value AS code FROM json_each(?)
    )
    SELECT
      p.publicationcode,
      COALESCE(NULLIF(p.title, ''), p.publicationcode) AS publication_title,
      p.countrycode,
      COALESCE(NULLIF(c.countryname, ''), p.countrycode) AS countryname,
      (SELECT COUNT(*) FROM inducks_issue i_tot WHERE i_tot.publicationcode = p.publicationcode) AS total_issues,
      COUNT(DISTINCT i.issuecode) AS owned_issues
    FROM inducks_issue i
    JOIN inducks_publication p ON i.publicationcode = p.publicationcode
    LEFT JOIN inducks_country c ON p.countrycode = c.countrycode
    WHERE i.issuecode IN (SELECT code FROM user_coll)
    GROUP BY p.publicationcode
    ORDER BY owned_issues DESC, total_issues DESC
  `;

  try {
    const result = await executeQuery({ sql, args: [jsonIssues] });
    return (result.rows as any[]).map((row) => {
      const total = Number(row.total_issues) || 0;
      const owned = Number(row.owned_issues) || 0;
      const missing = Math.max(0, total - owned);
      const percentage = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;

      return {
        publicationcode: row.publicationcode,
        publication_title: row.publication_title,
        countrycode: row.countrycode,
        countryname: row.countryname,
        total_issues: total,
        owned_issues: owned,
        missing_issues: missing,
        percentage,
      };
    });
  } catch (err) {
    console.error("Failed to fetch collection publication stats", err);
    return [];
  }
}

/**
 * Returns all issues belonging to a publication so the UI can partition them
 * into owned vs missing for detailed inspection.
 */
export async function getPublicationIssuesForCollection(
  publicationcode: string
): Promise<PublicationIssueItem[]> {
  const sql = `
    SELECT
      i.issuecode,
      i.issuenumber,
      i.issuerangecode,
      i.title AS issue_title,
      i.oldestdate
    FROM inducks_issue i
    WHERE i.publicationcode = ?
    ORDER BY NULLIF(i.oldestdate, '') ASC NULLS LAST, i.issuenumber ASC
  `;

  try {
    const result = await executeQuery({ sql, args: [publicationcode] });
    return (result.rows as any[]).map((row) => ({
      issuecode: row.issuecode,
      issuenumber: row.issuenumber,
      issuerangecode: row.issuerangecode || null,
      issue_title: row.issue_title || null,
      oldestdate: row.oldestdate || null,
    }));
  } catch (err) {
    console.error(`Failed to fetch issues for publication ${publicationcode}`, err);
    return [];
  }
}

