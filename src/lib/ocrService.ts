/**
 * ocrService.ts
 * Client for the transcript search API (FTS5 index of OCR'd scans).
 *
 * VITE_TRANSCRIPT_API      base URL of the API; the hosted one answers while the
 *                          owner's PC is off (apps/transcript/worker). Defaults to
 *                          /api/transcript, proxied to the local server in dev.
 * VITE_TRANSCRIPT_API_KEY  key sent as X-API-Key (required by the hosted API).
 *
 * Returns null when the API is unavailable instead of throwing.
 */

const TRANSCRIPT_API = ((import.meta.env.VITE_TRANSCRIPT_API as string | undefined) || '/api/transcript')
  .replace(/\/$/, '');
const TRANSCRIPT_API_KEY = import.meta.env.VITE_TRANSCRIPT_API_KEY as string | undefined;

/** True when OCR search goes to a configured (hosted) API rather than the local server. */
export const ocrHosted = Boolean(import.meta.env.VITE_TRANSCRIPT_API);

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
  // The hosted API may cold-start; a dead local server still fails fast.
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const url = `${TRANSCRIPT_API}/search?q=${encodeURIComponent(query.trim())}&entries=1&limit=1000`;
    const res = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      headers: TRANSCRIPT_API_KEY ? { 'X-API-Key': TRANSCRIPT_API_KEY } : undefined,
    });
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
