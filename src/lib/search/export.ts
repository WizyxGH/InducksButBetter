import { SearchFilters } from './types';
import { buildAdvancedSearchQuery } from './queryBuilder';

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
    t("csv.storyCode") || "Story Code",
    t("csv.originalTitle") || "Title (Original)",
    t("csv.translatedTitle") || "Title (Translated)",
    t("csv.releaseDate") || "Release Date",
    t("csv.pages") || "Pages",
    t("csv.type") || "Type",
    t("csv.hero") || "Hero",
    t("csv.creators") || "Creators",
    t("csv.publications") || "Publications"
  ];

  const rows = results.map(row => {
    let creatorsStr = "";
    try {
      const creators = row.creator_list ? JSON.parse(row.creator_list) : [];
      creatorsStr = creators.map((c: any) => c.name).join(", ");
    } catch(e) {}

    let pubStr = "";
    try {
      const pubs = row.publication_list ? JSON.parse(row.publication_list) : [];
      pubStr = pubs.map((p: any) => `${p.name} ${p.issueNumber || ''}`.trim()).join(", ");
    } catch(e) {}

    return [
      row.storycode,
      row.original_title || "",
      row.translated_title || row.story_title || "",
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
