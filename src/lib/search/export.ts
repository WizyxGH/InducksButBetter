import { SearchFilters } from './types';
import { buildAdvancedSearchQuery } from './queryBuilder';
import { parseCredits } from '../credits';

/** Splits a ';'-separated aggregate column into its entries. */
function splitList(value: string | null | undefined): string[] {
  return value ? String(value).split(';').filter(Boolean) : [];
}

export async function exportSearchResultsToCsv(
  filters: SearchFilters, 
  lang: string, 
  executeLocalQuery: (query: string, params: any[]) => Promise<any[]>,
  t: (key: string) => string
): Promise<Blob> {
  // Use a reasonable limit to prevent memory crash but allow large exports
  const exportFilters = { ...filters, rowsperpage: "5000", page: 1, lang };
  
  const { query, params } = buildAdvancedSearchQuery(exportFilters);
  const results = await executeLocalQuery(query, params);

  if (!results || results.length === 0) {
    return new Blob([""], { type: "text/csv;charset=utf-8;" });
  }

  // Use the translation function provided by the caller
  const headers = [
    t("csv.storyCode"),
    t("csv.originalTitle"),
    t("csv.releaseDate"),
    t("csv.pages"),
    t("csv.type"),
    t("csv.hero"),
    t("csv.creators"),
    t("csv.publications")
  ];

  const rows = results.map(row => {
    // These columns arrive as ';'-separated `role:code|name` and
    // `country|title|issue` strings — never JSON. Parsing them as JSON threw
    // on every row, so both columns always exported empty.
    const { writers, artists } = parseCredits(row.creators);
    const creatorsStr = [...writers, ...artists]
      .filter((c, i, a) => a.findIndex((o) => o.code === c.code) === i)
      .map((c) => c.name)
      .join(", ");

    const pubStr = splitList(row.publication_list)
      .map((entry) => {
        const [, title, issueNumber] = entry.split("|");
        return `${title || ""} ${issueNumber || ""}`.trim();
      })
      .filter(Boolean)
      .filter((p, i, a) => a.indexOf(p) === i)
      .join(", ");

    return [
      row.storycode,
      row.original_title || row.story_title || "",
      row.firstpublicationdate || "",
      row.entirepages || "",
      row.kind || "",
      row.hero_name || "",
      creatorsStr,
      pubStr
    ];
  });

  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...rows.map(row => row.map(escapeCsv).join(","))
  ].join("\r\n");

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  return new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
}

export function escapeCsv(str: any): string {
  let s = String(str || "");
  // Prevent Excel formula injection which breaks display
  if (/^[=\-+\@]/.test(s)) {
    s = "'" + s;
  }
  s = s.replace(/"/g, '""');
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s}"`;
  }
  return s;
}
