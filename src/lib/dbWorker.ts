import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const DB_FILENAME = "/inducks.sqlite3";

let db: any = null;
let sqlite3: any = null;
let poolUtil: any = null;


async function initSqlite() {
  if (!sqlite3) {
    sqlite3 = await sqlite3InitModule();
  }
  return sqlite3;
}

let storageType: "sah" | "opfs" | "memory" = "memory";

async function getStorageType(s3: any) {
  if (s3.capi && s3.capi.sqlite3_vfs_find("opfs")) {
    return "opfs";
  }

  try {
    if (s3.installOpfsSAHPoolVfs) {
      if (!poolUtil) {
        poolUtil = await s3.installOpfsSAHPoolVfs({
          clearOnInit: false
        });
      }
      return "sah";
    }
  } catch (e) {
    console.warn("OPFS SAH Pool not supported:", e);
  }

  return "memory";
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

async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    }
  });
  const ds = new DecompressionStream('gzip');
  const decompressedStream = stream.pipeThrough(ds);
  return readStreamToUint8Array(decompressedStream);
}

const connections: MessagePort[] = [];

const handleMessage = async (e: MessageEvent, port: MessagePort) => {
  const { id, action, payload } = e.data;

  try {
    const s3 = await initSqlite();

    switch (action) {
      case "installDb": {
        const { url, file } = payload;
        
        const type = await getStorageType(s3);
        storageType = type;

        let responseStream: ReadableStream;

        if (url) {
          const urls = Array.isArray(url) ? url : [url].filter(Boolean);
          let response: Response | null = null;
          let fetchError: Error | null = null;

          for (const targetUrl of urls) {
            try {
              port.postMessage({ type: 'progress', step: 'download', percent: 0 });
              const headers: HeadersInit = {};
              if (targetUrl.includes('api.github.com')) {
                headers['Accept'] = 'application/octet-stream';
              }
              
              const res = await fetch(targetUrl, { headers });
              if (res.ok) {
                response = res;
                break;
              }
            } catch (err: any) {
              fetchError = err;
            }
          }

          if (!response) {
            throw new Error(`error_download|${fetchError?.message || 'Network error'}`);
          }

          const contentLength = Number(response.headers.get('content-length')) || 0;
          let loaded = 0;
          const targetResponse = response;

          responseStream = new ReadableStream({
            async start(controller) {
              const reader = targetResponse.body!.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  break;
                }
                loaded += value.byteLength;
                const percent = contentLength ? Math.min(Math.round((loaded / contentLength) * 100), 100) : 0;
                port.postMessage({ type: 'progress', step: 'download', loaded, total: contentLength, percent });
                controller.enqueue(value);
              }
            }
          });

        } else if (file) {
          responseStream = file.stream();
        } else {
          throw new Error("error_no_url");
        }

        // Determine if Gzip compressed by reading the first chunk
        const reader = responseStream.getReader();
        const firstRead = await reader.read();
        if (firstRead.done) {
          throw new Error("error_empty");
        }
        const firstChunk = firstRead.value;
        const isGzipped = firstChunk.length >= 2 && firstChunk[0] === 0x1f && firstChunk[1] === 0x8b;

        // Reconstruct the stream
        const rawStream = new ReadableStream({
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
          decompressedStream = rawStream.pipeThrough(ds);
        }

        port.postMessage({ type: 'progress', step: 'validate' });
        let isValid = false;
        let tempDb: any = null;

        if (type === "opfs") {
          const root = await navigator.storage.getDirectory();
          
          // Stream directly to temporary OPFS file on disk
          const tempHandle = await root.getFileHandle("inducks_temp.sqlite3", { create: true });
          const writable = await tempHandle.createWritable();
          await decompressedStream.pipeTo(writable);

          // Validate temp database on disk
          let validationError = "";
          try {
            tempDb = new s3.oo1.DB("/inducks_temp.sqlite3", "c", "opfs");
            const stmt = tempDb.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='inducks_story'");
            if (stmt.step()) {
              if (stmt.get({}).count > 0) isValid = true;
            }
            stmt.finalize();
          } catch (err: any) {
            validationError = err.message || String(err);
            console.error("Validation error:", err);
          } finally {
            if (tempDb) {
              try { tempDb.close(); } catch (e) {}
            }
          }

          if (!isValid) {
            try { await root.removeEntry("inducks_temp.sqlite3"); } catch (e) {}
            throw new Error(`error_validation|${validationError || "Empty or invalid database"}`);
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

            await poolUtil.importDb(DB_FILENAME, chunkReader);

            let validationError = "";
            try {
              db = new poolUtil.OpfsSAHPoolDb(DB_FILENAME);
              const stmt = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='inducks_story'");
              if (stmt.step()) {
                if (stmt.get({}).count > 0) isValid = true;
              }
              stmt.finalize();
            } catch (err: any) {
              validationError = err.message || String(err);
              console.error("Validation error:", err);
            }

            if (!isValid) {
              closeActiveDb();
              try { poolUtil.removeOpfsSAHPoolFile(DB_FILENAME); } catch (e) {}
              throw new Error(`error_validation|${validationError || "Empty or invalid database"}`);
            }

          } else {
            // Memory VFS
            // Note: memory fallback reads the entire DB into a Uint8Array, which may crash if the DB is too large!
            const decompressedData = await readStreamToUint8Array(decompressedStream);
            isValid = true;
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
          }
        }

        // Optimizations for read-only usage
        db.exec("PRAGMA journal_mode = OFF;");
        db.exec("PRAGMA synchronous = OFF;");
        db.exec("PRAGMA temp_store = MEMORY;");

        // Success! Get stats
        let tableCount = 0;
        let dbSize = 0;
        try {
          const stmt = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'");
          if (stmt.step()) tableCount = stmt.get({}).count;
          stmt.finalize();
          
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

        port.postMessage({ id, type: "success", stats: { size: dbSize || 1100000000, count: tableCount } });
        break;
      }
      
      case "loadCachedDb": {
        if (db) {
          let count = 0;
          let dbSize = 0;
          try {
             const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
             while(tablesQuery.step()) { count++; }
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
          } catch(e) {}
          port.postMessage({ id, type: "success", stats: { size: dbSize || 1100000000, count } });
          break;
        }
        
        const type = await getStorageType(s3);
        storageType = type;
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
          port.postMessage({ id, type: "not_found" });
          break;
        }
        
        let count = 0;
        let dbSize = 0;
        try {
           const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
           while(tablesQuery.step()) { count++; }
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
        } catch(e) {}
        
        port.postMessage({ id, type: "success", stats: { size: dbSize || 1100000000, count } });
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

self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0];
  connections.push(port);
  port.onmessage = (msg: MessageEvent) => handleMessage(msg, port);
  port.start();
};
