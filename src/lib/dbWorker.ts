import initSqlJs, { Database } from "sql.js";
import { DEFAULT_DB_SCHEMA } from "./defaultSchema";

const DB_NAME = "InducksCache";
const STORE_NAME = "dbStore";
const DB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e: any) => resolve(e.target.result);
    req.onerror = (e: any) => reject(e.target.error);
  });
}

async function saveToIDB(key: string, data: any): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(data, key);
    req.onsuccess = () => resolve();
    req.onerror = (e: any) => reject(e.target.error);
  });
}

async function loadFromIDB(key: string): Promise<any> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = (e: any) => resolve(e.target.result);
    req.onerror = (e: any) => reject(e.target.error);
  });
}

async function clearIDB(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e: any) => reject(e.target.error);
  });
}

let db: Database | null = null;

const isSharedWorker = typeof (self as any).onconnect !== 'undefined';

const handleMessage = async (e: MessageEvent, port: any) => {
  const { id, action, payload } = e.data;

  try {
    switch (action) {
      case "loadIsv": {
        const { files, baseUrl } = payload;
        
        const SQL = await initSqlJs({
          locateFile: (file) => file.endsWith('.wasm') 
            ? `${baseUrl}sql-wasm.wasm` 
            : `${baseUrl}${file}`
        });
        
        db = new SQL.Database();
        db.run("PRAGMA journal_mode = OFF;");
        db.run("PRAGMA synchronous = OFF;");
        db.run("PRAGMA temp_store = MEMORY;");
        let processed = 0;
        let totalGlobalBytes = files.reduce((acc: number, f: any) => acc + (f.size || 0), 0);
        let globalBytesRead = 0;
        let lastReportedGlobalPercent = -1;
        
        for (const file of files as any[]) {
          const fileName = file.name || file.name;
          const isUrl = !!file.url;
          const tableName = fileName.replace(/\.isv$/i, '').toLowerCase();
          
          const columns = DEFAULT_DB_SCHEMA[tableName];
          if (!columns) {
            console.warn(`Skipping ${fileName}: no schema found`);
            continue;
          }
          
          const startPercent = totalGlobalBytes > 0 
            ? Math.min(99, Math.round((globalBytesRead / totalGlobalBytes) * 100)) 
            : Math.round((processed / files.length) * 100);
          
          port.postMessage({ 
            type: 'progress', 
            table: tableName, 
            percent: startPercent,
            current: processed + 1, 
            total: files.length 
          });
          
          let stream;
          if (isUrl) {
            const res = await fetch(file.url);
            if (!res.ok || !res.body) {
              throw new Error(`Failed to download ${fileName} (status ${res.status})`);
            }
            stream = res.body.pipeThrough(new TextDecoderStream());
          } else {
            stream = file.stream().pipeThrough(new TextDecoderStream());
          }
          
          db.run(`CREATE TABLE ${tableName} (${columns.map(c => `"${c}" TEXT`).join(", ")});`);
          db.run("BEGIN TRANSACTION;");
          
          let stmt = db.prepare(`INSERT INTO ${tableName} VALUES (${columns.map(() => "?").join(",")});`);
          const colCount = columns.length;
          
          const reader = stream.getReader();
          let partialLine = "";
          let isFirstLine = true;
          let bytesRead = 0;
          let lastReportedPercent = -1;
          const fileSize = file.size || 0;
          let rowCount = 0;
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            bytesRead += value.length;
            
            const lines = (partialLine + value).split('\n');
            partialLine = lines.pop() || "";
            
            for (let j = 0; j < lines.length; j++) {
              const line = lines[j];
              if (!line || line === "\r") continue;
              const cleanLine = line.endsWith('\r') ? line.slice(0, -1) : line;
              
              if (isFirstLine) {
                isFirstLine = false;
                continue;
              }
              
              const values = cleanLine.split('^');
              const boundValues = new Array(colCount);
              for (let i = 0; i < colCount; i++) {
                boundValues[i] = values[i] !== undefined ? values[i] : null;
              }
              stmt.run(boundValues);
              rowCount++;
              
              if (rowCount % 25000 === 0) {
                stmt.free();
                db.run("COMMIT;");
                db.run("BEGIN TRANSACTION;");
                stmt = db.prepare(`INSERT INTO ${tableName} VALUES (${columns.map(() => "?").join(",")});`);
              }
            }

            if (fileSize > 0) {
              let globalPercent = 0;
              if (totalGlobalBytes > 0) {
                globalPercent = Math.min(99, Math.round(((globalBytesRead + bytesRead) / totalGlobalBytes) * 100));
              } else {
                globalPercent = Math.round(((processed + (bytesRead / fileSize)) / files.length) * 100);
              }

              if (globalPercent > lastReportedGlobalPercent) {
                lastReportedGlobalPercent = globalPercent;
                port.postMessage({
                  type: 'progress',
                  table: tableName,
                  percent: globalPercent,
                  current: processed + 1,
                  total: files.length
                });
              }
            }
          }
          
          if (partialLine && partialLine !== "\r") {
            const cleanLine = partialLine.endsWith('\r') ? partialLine.slice(0, -1) : partialLine;
            if (!isFirstLine) {
              const values = cleanLine.split('^');
              const boundValues = new Array(colCount);
              for (let i = 0; i < colCount; i++) {
                boundValues[i] = values[i] !== undefined ? values[i] : null;
              }
              stmt.run(boundValues);
            }
          }
          
          stmt.free();
          db.run("COMMIT;");
          globalBytesRead += fileSize;
          processed++;
        }
        
        port.postMessage({ type: 'progress', table: "Creating indexes...", percent: 100, current: files.length, total: files.length });
        
        const INDEXES_TO_CREATE: Record<string, string[]> = {
          inducks_story: ["storycode", "storyheadercode", "firstpublicationdate"],
          inducks_storyversion: ["storycode", "storyversioncode", "entirepages"],
          inducks_storyjob: ["storyversioncode", "personcode"],
          inducks_entry: ["storyversioncode", "issuecode"],
          inducks_issue: ["issuecode", "publicationcode", "oldestdate", "pages"],
          inducks_publication: ["publicationcode", "countrycode", "languagecode"],
          inducks_herocharacter: ["storycode", "charactercode"],
          inducks_character: ["charactercode"],
          inducks_person: ["personcode"],
          inducks_country: ["countrycode"],
          inducks_language: ["languagecode"],
          inducks_storyheader: ["title", "storyheadercode"],
          inducks_appearance: ["storyversioncode", "charactercode"],
          inducks_storysubseries: ["storycode", "subseriescode"],
          inducks_subseriesname: ["subseriescode"],
          inducks_entryurl: ["entrycode"],
          inducks_storydescription: ["storyversioncode"],
          inducks_charactername: ["charactercode"],
          inducks_characterurl: ["charactercode"],
          inducks_publishingjob: ["issuecode", "publisherid"],
          inducks_storycodes: ["storycode", "alternativecode"],
          inducks_issueurl: ["issuecode"],
          inducks_indexer: ["indexer"]
        };

        db.run("BEGIN TRANSACTION;");
        for (const [table, columns] of Object.entries(INDEXES_TO_CREATE)) {
          for (const col of columns) {
            try {
              db.run(`CREATE INDEX IF NOT EXISTS idx_${table}_${col} ON ${table}(${col});`);
            } catch (err) {}
          }
        }
        try {
          db.run(`CREATE INDEX IF NOT EXISTS idx_inducks_person_numissues ON inducks_person(CAST(numberofindexedissues AS INTEGER));`);
        } catch (err) {}
        db.run("COMMIT;");
        
        if (processed < files.length) {
          throw new Error(`Seulement ${processed}/${files.length} fichiers ont pu être importés. L'importation a échoué.`);
        }
        port.postMessage({ type: 'progress', table: "caching", percent: 100, current: files.length, total: files.length });
        
        try {
          const exported = db.export();
          await saveToIDB("inducks", exported);
        } catch (cacheErr) {
          console.warn("Failed to save to IndexedDB cache:", cacheErr);
        }
        
        port.postMessage({ id, type: "success" });
        break;
      }
      
      case "loadCachedDb": {
        const { baseUrl } = payload;
        
        // In a SharedWorker, if the DB is already loaded in RAM from another tab, 
        // we can instantly return success without reloading it from IndexedDB!
        if (db) {
          let count = 0;
          try {
             const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
             while(tablesQuery.step()) { count++; }
             tablesQuery.free();
          } catch(e) {}
          // Assuming size is unknown if already loaded without exporting, we just return a placeholder or cached size.
          port.postMessage({ id, type: "success", stats: { size: 100000000, count } });
          break;
        }
        
        const data = await loadFromIDB("inducks");
        if (!data) {
          port.postMessage({ id, type: "not_found" });
          break;
        }

        const SQL = await initSqlJs({
          locateFile: (file) => file.endsWith('.wasm') 
            ? `${baseUrl}sql-wasm.wasm` 
            : `${baseUrl}${file}`
        });
        
        db = new SQL.Database(data);
        
        let dbSize = data.byteLength || 0;
        let count = 0;
        try {
           const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
           while(tablesQuery.step()) { count++; }
           tablesQuery.free();
        } catch(e) {}
        
        port.postMessage({ id, type: "success", stats: { size: dbSize, count } });
        break;
      }
      
      case "clearCache": {
        await clearIDB("inducks");
        if (db) {
           db.close();
           db = null;
        }
        port.postMessage({ id, type: "success" });
        break;
      }
      
      case "execute": {
        if (!db) throw new Error("Database not loaded");
        const { sql, args, stream } = payload;
        
        const stmt = db.prepare(sql);
        stmt.bind(args || []);
        
        const columns = stmt.getColumnNames();
        const rows = [];
        let count = 0;
        
        while (stmt.step()) {
          const row = stmt.getAsObject();
          if (stream) {
            port.postMessage({ id, type: "row", row, index: count });
          } else {
            rows.push(row);
          }
          count++;
        }
        
        stmt.free();
        port.postMessage({ id, type: "success", rows: stream ? undefined : rows, columns, count });
        break;
      }
      
      case "unload": {
        // In a SharedWorker, unloading the DB from one tab might break other tabs.
        // We only close it if explicitly requested, but maybe we shouldn't.
        // For now, we will honor it, but usually tabs shouldn't unload the SharedWorker DB.
        if (!isSharedWorker) {
           if (db) {
             db.close();
             db = null;
           }
        }
        port.postMessage({ id, type: "success" });
        break;
      }
    }
  } catch (error: any) {
    port.postMessage({ id, type: "error", error: error.message || String(error) });
  }
};

if (isSharedWorker) {
  (self as any).onconnect = (e: MessageEvent) => {
    const port = e.ports[0];
    port.onmessage = (msg: MessageEvent) => handleMessage(msg, port);
    port.start();
  };
} else {
  self.onmessage = (msg: MessageEvent) => handleMessage(msg, self);
}
