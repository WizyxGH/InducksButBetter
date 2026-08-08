import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { openResumableStream } from "./download";

const DB_FILENAME = "/inducks.sqlite3";

/**
 * The full Inducks snapshot decompresses to ~1.06 GiB. Anything much smaller
 * is a truncated download or a wrong file, and installing it would replace a
 * working database with a broken one.
 */
const MIN_DB_BYTES = 500 * 1024 * 1024;

let db: any = null;
let sqlite3: any = null;
let poolUtil: any = null;

/**
 * Which backend the active database lives on.
 *
 * Only `opfs` and `sah` survive a reload. `memory` is a last-resort fallback
 * (no OPFS at all, or the sync access handles are already held by another
 * client) and is reported to the UI so a ~1 GB import that will vanish with
 * the tab is never presented as installed for good.
 */
type StorageType = "opfs" | "sah" | "memory";

let storageType: StorageType = "memory";

/** The last reason the SAH pool could not be installed, for diagnostics. */
let storageError = "";

async function initSqlite() {
  if (!sqlite3) {
    sqlite3 = await sqlite3InitModule();
  }
  return sqlite3;
}


async function getStorageType(s3: any): Promise<StorageType> {
  if (s3.capi && s3.capi.sqlite3_vfs_find("opfs")) {
    storageType = "opfs";
    return storageType;
  }

  try {
    if (s3.installOpfsSAHPoolVfs) {
      if (!poolUtil) {
        poolUtil = await s3.installOpfsSAHPoolVfs({
          clearOnInit: false
        });
      }
      storageError = "";
      storageType = "sah";
      return storageType;
    }
    storageError = "OPFS SAH pool unavailable in this browser";
  } catch (e: any) {
    // Not cached as a permanent verdict: the handles may simply be held by a
    // client that is going away, so the next call retries instead of pinning
    // the whole session to the volatile in-memory VFS.
    storageError = e?.message || String(e);
    console.warn("OPFS SAH Pool not supported:", e);
  }

  storageType = "memory";
  return storageType;
}

/** Read-only tuning; re-applied on every open, not only after an import. */
function applyReadOnlyPragmas() {
  db.exec("PRAGMA journal_mode = OFF;");
  db.exec("PRAGMA synchronous = OFF;");
  db.exec("PRAGMA temp_store = MEMORY;");
}

/**
 * Stats sent back to the UI.
 *
 * `persistent` is the one the UI acts on: a database installed on the memory
 * VFS works for the session but is gone on the next load, and users were
 * left to rediscover that by re-importing a gigabyte.
 */
function collectStats() {
  let count = 0;
  let dbSize = 0;
  try {
    const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
    while (tablesQuery.step()) { count++; }
    tablesQuery.finalize();

    let pageSize = 4096;
    let pageCount = 0;
    const stmtPageSize = db.prepare("PRAGMA page_size");
    if (stmtPageSize.step()) pageSize = stmtPageSize.get({}).page_size;
    stmtPageSize.finalize();

    const stmtPageCount = db.prepare("PRAGMA page_count");
    if (stmtPageCount.step()) pageCount = stmtPageCount.get({}).page_count;
    stmtPageCount.finalize();

    dbSize = pageSize * pageCount;
  } catch (e) {}

  return {
    size: dbSize || 1100000000,
    count,
    storage: storageType,
    persistent: storageType !== "memory",
    storageError: storageError || undefined,
  };
}

function closeActiveDb() {
  if (db) {
    try {
      db.close();
    } catch (e) {
      console.warn("Error closing db:", e);
    }
    db = null;
  }
}

async function readStreamToUint8Array(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.byteLength;
  }
  
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** Keeps download error messages readable by dropping query strings. */
function shortenUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname}${pathname}`;
  } catch {
    return url;
  }
}

/**
 * Validates an open SQLite connection before it is accepted as the new
 * database. Returns an empty string when valid, or the reason it is not.
 *
 * Three independent checks, cheapest first: the schema must contain
 * `inducks_story` (any other file is simply not an Inducks export), the
 * decompressed size must be plausible (a truncated gzip can still be a
 * readable-but-incomplete database), and `PRAGMA quick_check(1)` must pass —
 * `quick_check` rather than `integrity_check` because the latter also
 * verifies every index checksum, far too slow on ~1 GiB over OPFS.
 */
function validateDbConnection(candidate: any): string {
  try {
    let hasStory = false;
    const stmt = candidate.prepare(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='inducks_story'"
    );
    if (stmt.step()) hasStory = stmt.get({}).count > 0;
    stmt.finalize();
    if (!hasStory) return "missing inducks_story table";

    let pageSize = 0;
    let pageCount = 0;
    const stmtSize = candidate.prepare("PRAGMA page_size");
    if (stmtSize.step()) pageSize = stmtSize.get({}).page_size;
    stmtSize.finalize();
    const stmtCount = candidate.prepare("PRAGMA page_count");
    if (stmtCount.step()) pageCount = stmtCount.get({}).page_count;
    stmtCount.finalize();
    const bytes = pageSize * pageCount;
    if (bytes < MIN_DB_BYTES) {
      return `implausibly small database (${bytes} bytes, expected > ${MIN_DB_BYTES})`;
    }

    let verdict = "";
    const stmtCheck = candidate.prepare("PRAGMA quick_check(1)");
    if (stmtCheck.step()) verdict = String(stmtCheck.get({}).quick_check ?? "");
    stmtCheck.finalize();
    if (verdict !== "ok") return `quick_check failed: ${verdict || "no result"}`;

    return "";
  } catch (err: any) {
    return err?.message || String(err);
  }
}

const SQLITE_MAGIC = "SQLite format 3";

/**
 * Rejects an obviously wrong local file before a single byte is written.
 *
 * A gigabyte-scale import that only fails at the SQLite validation stage
 * wastes minutes; a 3-byte text file or a PNG can be refused from its first
 * 16 bytes. Throws `error_validation|…` so the UI wording stays translated.
 */
async function assertPlausibleLocalFile(file: File): Promise<void> {
  if (file.size < 512) {
    throw new Error(`error_validation|File is too small (${file.size} bytes) to be a database`);
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isGzip = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
  const isSqlite =
    head.length >= SQLITE_MAGIC.length &&
    SQLITE_MAGIC.split("").every((c, i) => head[i] === c.charCodeAt(0));
  if (!isGzip && !isSqlite) {
    throw new Error(
      "error_validation|File is neither gzip-compressed nor a SQLite database"
    );
  }
}

/**
 * Wraps a stream so cumulative byte counts are reported as they flow.
 * `Content-Length` covers the compressed body only, so once gzip enters the
 * picture this is the only way to show any life during decompression.
 */
function withByteCounter(
  source: ReadableStream<Uint8Array>,
  onBytes: (loaded: number) => void
): ReadableStream<Uint8Array> {
  let loaded = 0;
  const reader = source.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      loaded += value.byteLength;
      onBytes(loaded);
      controller.enqueue(value);
    },
    cancel(reason) {
      try {
        reader.cancel(reason);
      } catch {}
    },
  });
}

const handleMessage = async (e: MessageEvent, port: MessagePort) => {
  const { id, action, payload } = e.data;

  try {
    const s3 = await initSqlite();

    switch (action) {
      case "installDb": {
        const { url, file } = payload;

        const type = await getStorageType(s3);

        /**
         * Consumes one candidate stream end-to-end: sniff gzip, decompress,
         * write to the backend, validate, swap in. Throws `code|detail`
         * errors; the caller decides whether another source is worth trying.
         */
        const installFromStream = async (responseStream: ReadableStream<Uint8Array>) => {
        // Determine if Gzip compressed by reading the first chunk
        const reader = responseStream.getReader();
        const firstRead = await reader.read();
        if (firstRead.done) {
          throw new Error("error_empty");
        }
        const firstChunk = firstRead.value;
        const isGzipped = firstChunk.length >= 2 && firstChunk[0] === 0x1f && firstChunk[1] === 0x8b;

        // Reconstruct the stream
        const rawStream = new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(firstChunk);
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              controller.enqueue(value);
            }
          }
        });

        let decompressedStream = rawStream;
        if (isGzipped) {
          port.postMessage({ type: 'progress', step: 'decompress' });
          const ds = new DecompressionStream('gzip');
          // The decompressed size is unknown up front, so this progress is
          // indeterminate — but reporting the bytes produced at least proves
          // the pipeline is alive during a step that takes minutes.
          let lastReport = 0;
          // The lib.dom typing of DecompressionStream accepts BufferSource on
          // its writable side, which TS refuses to pair with a Uint8Array
          // readable — the runtime shapes are compatible.
          const gunzipped = rawStream.pipeThrough(
            ds as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
          );
          decompressedStream = withByteCounter(gunzipped, (loaded) => {
            if (loaded - lastReport >= 64 * 1024 * 1024) {
              lastReport = loaded;
              port.postMessage({ type: 'progress', step: 'decompress', loaded, total: 0, percent: 0 });
            }
          });
        }

        if (type === "opfs") {
          const root = await navigator.storage.getDirectory();

          // Stream directly to temporary OPFS file on disk
          const tempHandle = await root.getFileHandle("inducks_temp.sqlite3", { create: true });
          try {
            const writable = await tempHandle.createWritable();
            await decompressedStream.pipeTo(writable);
          } catch (err) {
            // An aborted write must not leave a half-written temp file behind.
            try { await root.removeEntry("inducks_temp.sqlite3"); } catch (e) {}
            throw err;
          }

          // Validate temp database on disk — the live database stays untouched
          // until the candidate passed every check.
          port.postMessage({ type: 'progress', step: 'validate' });
          let validationError = "";
          let tempDb: any = null;
          try {
            tempDb = new s3.oo1.DB("/inducks_temp.sqlite3", "c", "opfs");
            validationError = validateDbConnection(tempDb);
          } catch (err: any) {
            validationError = err.message || String(err);
            console.error("Validation error:", err);
          } finally {
            if (tempDb) {
              try { tempDb.close(); } catch (e) {}
            }
          }

          if (validationError) {
            try { await root.removeEntry("inducks_temp.sqlite3"); } catch (e) {}
            throw new Error(`error_validation|${validationError}`);
          }

          port.postMessage({ type: 'progress', step: 'install' });
          closeActiveDb();

          if (typeof (tempHandle as any).move === "function") {
             await (tempHandle as any).move("inducks.sqlite3");
           } else {
             const mainHandle = await root.getFileHandle("inducks.sqlite3", { create: true });
             const mainWritable = await mainHandle.createWritable();
             const tempFile = await tempHandle.getFile();
             await tempFile.stream().pipeTo(mainWritable);
             await root.removeEntry("inducks_temp.sqlite3");
           }

           db = new s3.oo1.DB("/inducks.sqlite3", "c", "opfs");

        } else {
          if (type === "sah") {
            // KNOWN LIMIT: unlike the plain-OPFS path above, this one is not
            // atomic. The SAH pool exposes no rename, so `importDb` has to
            // write to the live filename directly — a failure mid-import
            // loses the previous database. Making it atomic would mean
            // importing under a temp name and copying through RAM (~1 GiB),
            // which is exactly what this streaming path exists to avoid. The
            // partial file is at least removed so the pool is left clean.
            port.postMessage({ type: 'progress', step: 'install' });
            closeActiveDb();

            try {
              if (poolUtil.getFileCount() > 0 && poolUtil.getFileNames().includes(DB_FILENAME)) {
                poolUtil.removeOpfsSAHPoolFile(DB_FILENAME);
              }
            } catch (e) {}

            const decompressedReader = decompressedStream.getReader();
            const chunkReader = async () => {
              const { done, value } = await decompressedReader.read();
              if (done) return undefined;
              return value;
            };

            try {
              await poolUtil.importDb(DB_FILENAME, chunkReader);
            } catch (err) {
              try { poolUtil.removeOpfsSAHPoolFile(DB_FILENAME); } catch (e) {}
              throw err;
            }

            port.postMessage({ type: 'progress', step: 'validate' });
            let validationError = "";
            try {
              db = new poolUtil.OpfsSAHPoolDb(DB_FILENAME);
              validationError = validateDbConnection(db);
            } catch (err: any) {
              validationError = err.message || String(err);
              console.error("Validation error:", err);
            }

            if (validationError) {
              closeActiveDb();
              try { poolUtil.removeOpfsSAHPoolFile(DB_FILENAME); } catch (e) {}
              throw new Error(`error_validation|${validationError}`);
            }

          } else {
            // Memory VFS
            // Note: memory fallback reads the entire DB into a Uint8Array, which may crash if the DB is too large!
            const decompressedData = await readStreamToUint8Array(decompressedStream);
            port.postMessage({ type: 'progress', step: 'install' });
            closeActiveDb();

            db = new s3.oo1.DB("/inducks.sqlite3", "c");
            if (s3.capi && s3.capi.sqlite3_deserialize) {
              const pData = s3.wasm.allocFromTypedArray(decompressedData);
              const rc = s3.capi.sqlite3_deserialize(
                db.pointer,
                "main",
                pData,
                decompressedData.byteLength,
                decompressedData.byteLength,
                0
              );
              if (rc !== 0) {
                throw new Error(`error_deserialize|${rc}`);
              }
            }

            port.postMessage({ type: 'progress', step: 'validate' });
            const validationError = validateDbConnection(db);
            if (validationError) {
              closeActiveDb();
              throw new Error(`error_validation|${validationError}`);
            }
          }
        }
        };

        if (url) {
          const urls = (Array.isArray(url) ? url : [url]).filter(Boolean);
          if (urls.length === 0) {
            throw new Error("error_no_url");
          }

          const failures: string[] = [];
          let installed = false;

          for (const targetUrl of urls) {
            try {
              port.postMessage({ type: 'progress', step: 'download', percent: 0 });
              const headers: Record<string, string> = {};
              // GitHub only serves release assets as raw bytes (and with CORS
              // headers) through its API endpoint when this header is set.
              if (targetUrl.includes('api.github.com')) {
                headers['Accept'] = 'application/octet-stream';
              }

              // Resumable download: transient network failures retry with a
              // Range request from the last byte received, so a hiccup at 90%
              // of ~285 MB does not restart the transfer from zero.
              const { stream } = await openResumableStream(targetUrl, {
                headers,
                onProgress: (loaded, total) => {
                  const percent = total ? Math.min(Math.round((loaded / total) * 100), 100) : 0;
                  port.postMessage({ type: 'progress', step: 'download', loaded, total, percent });
                },
              });

              await installFromStream(stream);
              installed = true;
              break;
            } catch (err: any) {
              const msg = err?.message || 'network error';
              // A payload that downloaded fully but failed validation will be
              // byte-identical on every mirror — re-downloading a gigabyte
              // from the next source cannot fix it, so surface it right away.
              if (msg.startsWith('error_validation') || msg.startsWith('error_deserialize')) {
                throw err;
              }
              // A CORS rejection surfaces as an opaque TypeError, so name the
              // URL that failed — otherwise the user only sees "NetworkError".
              failures.push(`${shortenUrl(targetUrl)}: ${msg}`);
            }
          }

          if (!installed) {
            throw new Error(`error_download|${failures.join(' — ') || 'no source available'}`);
          }
        } else if (file) {
          // Refuse an obviously wrong file before a single byte is processed.
          await assertPlausibleLocalFile(file);

          // Local reads are fast but not instant on ~1 GiB: reuse the download
          // progress channel so the user sees the file being consumed.
          let lastPercent = -1;
          const counted = withByteCounter(file.stream(), (loaded) => {
            const percent = file.size ? Math.min(Math.round((loaded / file.size) * 100), 100) : 0;
            if (percent !== lastPercent) {
              lastPercent = percent;
              port.postMessage({ type: 'progress', step: 'download', loaded, total: file.size, percent });
            }
          });
          await installFromStream(counted);
        } else {
          throw new Error("error_no_url");
        }

        // Optimizations for read-only usage
        applyReadOnlyPragmas();

        // The import is only worth anything if the bytes actually landed in a
        // store that outlives the tab. Confirm it here rather than letting the
        // user discover on the next reload that nothing was kept.
        if (type === "sah" && !poolUtil.getFileNames().includes(DB_FILENAME)) {
          throw new Error("error_validation|Database was not persisted to OPFS.");
        }
        if (type === "opfs") {
          const root = await navigator.storage.getDirectory();
          await root.getFileHandle("inducks.sqlite3", { create: false });
        }

        port.postMessage({ id, type: "success", stats: collectStats() });
        break;
      }
      
      case "loadCachedDb": {
        // A SharedWorker outlives the page, so a reload usually finds the
        // database still open — reuse it rather than reopening the handles.
        if (db) {
          port.postMessage({ id, type: "success", stats: collectStats() });
          break;
        }

        const type = await getStorageType(s3);
        let found = false;

        if (type === "sah") {
          if (poolUtil.getFileCount() > 0 && poolUtil.getFileNames().includes(DB_FILENAME)) {
             found = true;
             db = new poolUtil.OpfsSAHPoolDb(DB_FILENAME);
          }
        } else if (type === "opfs") {
          const root = await navigator.storage.getDirectory();
          try {
            await root.getFileHandle("inducks.sqlite3", { create: false });
            found = true;
            db = new s3.oo1.DB("/inducks.sqlite3", "c", "opfs");
          } catch (e) {}
        }

        if (!found) {
          // The storage verdict travels with the reply: on the memory VFS the
          // persistent backend never opened, so the client must retry rather
          // than conclude that nothing was ever installed.
          port.postMessage({ id, type: "not_found", storage: storageType, storageError });
          break;
        }

        // The install path tunes the connection for read-only use; a database
        // reopened from storage needs the same treatment.
        applyReadOnlyPragmas();

        port.postMessage({ id, type: "success", stats: collectStats() });
        break;
      }
      
      case "clearCache": {
        closeActiveDb();
        const type = await getStorageType(s3);
        if (type === "sah") {
           if (poolUtil) {
              try { poolUtil.removeOpfsSAHPoolFile(DB_FILENAME); } catch (e) {}
           }
        } else if (type === "opfs") {
           try {
             const root = await navigator.storage.getDirectory();
             await root.removeEntry("inducks.sqlite3");
           } catch (e) {}
        }
        port.postMessage({ id, type: "success" });
        break;
      }
      
      case "execute": {
        if (!db) throw new Error("error_not_loaded");
        const { sql, args, stream } = payload;
        
        const stmt = db.prepare(sql);
        if (args && args.length > 0) {
            stmt.bind(args);
        }
        
        const columns = stmt.getColumnNames();
        const rows = [];
        let count = 0;
        
        while (stmt.step()) {
          const row = stmt.get({});
          if (stream) {
            port.postMessage({ id, type: "row", row, index: count });
          } else {
            rows.push(row);
          }
          count++;
        }
        
        stmt.finalize();
        port.postMessage({ id, type: "success", rows: stream ? undefined : rows, columns, count });
        break;
      }
      
      case "unload": {
        if (db) {
          db.close();
          db = null;
        }
        port.postMessage({ id, type: "success" });
        break;
      }
    }
  } catch (error: any) {
    port.postMessage({ id, type: "error", error: error.message || String(error) });
  }
};

// The same worker file backs both a SharedWorker (one owner of the OPFS
// handles across every tab) and a dedicated worker (browsers without
// SharedWorker support). Detect which scope we are running in.
const isSharedWorkerScope =
  typeof (globalThis as any).SharedWorkerGlobalScope !== "undefined" &&
  self instanceof (globalThis as any).SharedWorkerGlobalScope;

if (isSharedWorkerScope) {
  (self as any).onconnect = (e: MessageEvent) => {
    const port = e.ports[0];
    port.onmessage = (msg: MessageEvent) => handleMessage(msg, port);
    port.start();
  };
} else {
  self.onmessage = (msg: MessageEvent) => handleMessage(msg, self as any);
}
