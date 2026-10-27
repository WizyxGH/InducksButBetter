/**
 * ocrService.ts
 * Client for the transcript server's FTS5 OCR search API.
 * The transcript server runs on port 3001 (proxied via /api/transcript in dev).
 * Returns null when the server is unavailable instead of throwing.
 */

const TRANSCRIPT_API = '/api/transcript/search';

export interface OcrEntry {
  entrycode: string;
  issuecode: string;
  title: string | null;
  hits: number;
  pages: number[];
  firstSnippet: string;
  maxConfidence: number;
}

export interface OcrSearchResult {
  total: number;
  entries: OcrEntry[];
  /** Unique entrycodes that matched */
  entrycodes: string[];
  /** Unique issuecodes that matched (required for high-performance indexed queries) */
  issuecodes: string[];
}

/**
 * Search the transcript server's OCR index.
 * Returns null if the server is unavailable (not running locally).
 * Includes an internal timeout to avoid hanging when the server does not respond.
 */
export async function searchOcr(
  query: string,
  signal?: AbortSignal
): Promise<OcrSearchResult | null> {
  if (!query.trim()) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const url = `${TRANSCRIPT_API}?q=${encodeURIComponent(query.trim())}&entries=1&limit=500`;
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!res.ok) return null;
    const data = await res.json();
    const entries: OcrEntry[] = (data.entries ?? []).map((e: any) => ({
      entrycode: e.entrycode ?? e.key,
      issuecode: e.issuecode,
      title: e.title ?? null,
      hits: e.hits ?? 1,
      pages: e.pages ?? [],
      firstSnippet: e.firstSnippet ?? '',
      maxConfidence: e.maxConfidence ?? 0,
    }));

    const issuecodes = [...new Set(entries.map((e) => e.issuecode).filter(Boolean))];
    const entrycodes = [...new Set(entries.map((e) => e.entrycode).filter(Boolean))];

    return {
      total: data.total ?? entries.length,
      entries,
      entrycodes,
      issuecodes,
    };
  } catch (err: any) {
    if (signal?.aborted) throw err;
    // Server not running or timed out — silently return null
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
