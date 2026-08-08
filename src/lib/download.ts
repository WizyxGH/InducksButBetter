/**
 * Resumable streaming download.
 *
 * The pre-built database is a ~285 MB gzip file: on a flaky connection a
 * plain `fetch` that dies at 90% forces the user to restart from zero. This
 * module wraps `fetch` in a ReadableStream that transparently retries and —
 * when the server advertises `Accept-Ranges: bytes` — resumes from the last
 * byte received instead of starting over. It is deliberately free of worker
 * or DOM dependencies so the retry/resume logic can be unit-tested with a
 * mocked `fetch`.
 */

export interface ResumableDownloadOptions {
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  /**
   * Maximum number of *consecutive* fetch attempts before giving up. The
   * counter resets every time a chunk actually arrives, so a long download
   * over a flaky link is not capped at N hiccups in total.
   */
  maxAttempts?: number;
  /** Base backoff delay in ms, doubled after each consecutive failure. */
  baseDelayMs?: number;
  /** Injectable for tests, so backoff does not slow the suite down. */
  sleep?: (ms: number) => Promise<void>;
  /** Called with the cumulative byte count — it keeps growing across resumes. */
  onProgress?: (loaded: number, total: number) => void;
}

export interface ResumableDownload {
  stream: ReadableStream<Uint8Array>;
  /** Total size in bytes as advertised by the server, 0 when unknown. */
  total: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Opens `url` and returns a stream of its body that survives network errors.
 *
 * The returned promise rejects when the *initial* request cannot be opened
 * after `maxAttempts` tries; once the stream is handed out, mid-transfer
 * failures (a rejected read, or the connection closing before
 * `Content-Length` bytes arrived) are retried with a `Range: bytes=N-`
 * request. When the server ignores the range and replies 200, the bytes
 * already delivered are skipped from the new body instead of being emitted
 * twice — resuming still works, it just re-transfers.
 */
export async function openResumableStream(
  url: string,
  options: ResumableDownloadOptions = {}
): Promise<ResumableDownload> {
  const {
    fetchImpl = fetch,
    headers = {},
    maxAttempts = 5,
    baseDelayMs = 1000,
    sleep = defaultSleep,
    onProgress,
  } = options;

  let attempts = 0;
  let lastError = "";
  let loaded = 0;
  /** Bytes of the current response body to drop before emitting (200-on-resume). */
  let skipRemaining = 0;
  let acceptRanges = false;

  const doFetch = async (rangeStart: number): Promise<Response> => {
    const h: Record<string, string> = { ...headers };
    if (rangeStart > 0) h["Range"] = `bytes=${rangeStart}-`;
    return fetchImpl(url, { headers: h, redirect: "follow" });
  };

  /**
   * Fetches (or re-fetches) the body with retry + backoff, positioning
   * `skipRemaining` so the stream continues exactly at byte `loaded`.
   */
  const openBody = async (): Promise<ReadableStreamDefaultReader<Uint8Array>> => {
    for (;;) {
      attempts++;
      if (attempts > 1) {
        // Exponential backoff: 1×, 2×, 4×… of the base delay.
        await sleep(baseDelayMs * 2 ** (attempts - 2));
      }
      try {
        const wantRange = loaded > 0 && acceptRanges;
        const res = await doFetch(wantRange ? loaded : 0);
        if (!res.ok || !res.body) {
          lastError = `HTTP ${res.status}`;
        } else {
          if (loaded === 0) {
            acceptRanges = (res.headers.get("accept-ranges") || "")
              .toLowerCase()
              .includes("bytes");
            total = Number(res.headers.get("content-length")) || 0;
            skipRemaining = 0;
            return res.body.getReader();
          }
          if (wantRange && res.status === 206) {
            // Trust but verify: a proxy may resume at a different offset.
            const match = /bytes (\d+)-/.exec(res.headers.get("content-range") || "");
            const start = match ? Number(match[1]) : loaded;
            if (start > loaded) {
              lastError = `server resumed at byte ${start} instead of ${loaded}`;
            } else {
              skipRemaining = loaded - start;
              return res.body.getReader();
            }
          } else {
            // Full body again (no range support, or the range was ignored):
            // skip what was already delivered rather than duplicating it.
            skipRemaining = loaded;
            return res.body.getReader();
          }
        }
      } catch (err: any) {
        // A CORS rejection or connection reset surfaces as an opaque
        // TypeError with no useful detail — keep whatever message exists.
        lastError = err?.message || "network error";
      }
      if (attempts >= maxAttempts) {
        throw new Error(`failed after ${attempts} attempts (${lastError})`);
      }
    }
  };

  let total = 0;
  let reader = await openBody();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch (err: any) {
          lastError = err?.message || "network error";
          reader = await openBody();
          continue;
        }

        if (result.done) {
          if (total > 0 && loaded < total) {
            // The server closed the connection early — an error `fetch`
            // reports as a clean EOF. Resume from where it stopped.
            lastError = `connection closed at byte ${loaded} of ${total}`;
            reader = await openBody();
            continue;
          }
          controller.close();
          return;
        }

        let chunk = result.value;
        if (skipRemaining > 0) {
          if (chunk.byteLength <= skipRemaining) {
            skipRemaining -= chunk.byteLength;
            continue;
          }
          chunk = chunk.subarray(skipRemaining);
          skipRemaining = 0;
        }

        // Data is flowing again: the *consecutive* failure budget refills.
        attempts = 0;
        loaded += chunk.byteLength;
        onProgress?.(loaded, total);
        controller.enqueue(chunk);
        return;
      }
    },
    cancel(reason) {
      try {
        reader.cancel(reason);
      } catch {
        /* the reader may already be broken */
      }
    },
  });

  return { stream, total };
}
