import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { DEFAULT_DB_SCHEMA } from "./defaultSchema";

const DB_FILENAME = "/inducks.sqlite3";

let db: any = null;
let sqlite3: any = null;
let poolUtil: any = null;

const isSharedWorker = typeof (self as any).onconnect !== 'undefined';

async function initSqlite() {
  if (!sqlite3) {
    sqlite3 = await sqlite3InitModule();
  }
  return sqlite3;
}

const handleMessage = async (e: MessageEvent, port: any) => {
  const { id, action, payload } = e.data;

  try {
    const s3 = await initSqlite();

    switch (action) {
      case "loadIsv": {
        const { files, baseUrl } = payload;
        
        let opfsSupported = false;
        try {
          if (s3.installOpfsSAHPoolVfs) {
            if (!poolUtil) {
              poolUtil = await s3.installOpfsSAHPoolVfs({
                clearOnInit: false
              });
            }
            opfsSupported = true;
          }
        } catch (e) {
          console.warn("OPFS SAH Pool not supported:", e);
        }

        if (opfsSupported) {
          if (poolUtil.getFileCount() > 0) {
             poolUtil.removeOpfsSAHPoolFile(DB_FILENAME);
          }
          db = new poolUtil.OpfsSAHPoolDb(DB_FILENAME);
        } else {
          db = new s3.oo1.DB(DB_FILENAME, 'c');
        }

        db.exec("PRAGMA journal_mode = OFF;");
        db.exec("PRAGMA synchronous = OFF;");
        db.exec("PRAGMA temp_store = MEMORY;");

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
          
          db.exec(`CREATE TABLE ${tableName} (${columns.map(c => `"${c}" TEXT`).join(", ")});`);
          db.exec("BEGIN TRANSACTION;");
          
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
              stmt.bind(boundValues).stepReset();
              rowCount++;
              
              if (rowCount % 150000 === 0) {
                stmt.finalize();
                db.exec("COMMIT;");
                db.exec("BEGIN TRANSACTION;");
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
              stmt.bind(boundValues).stepReset();
            }
          }
          
          stmt.finalize();
          db.exec("COMMIT;");
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

        db.exec("BEGIN TRANSACTION;");
        for (const [table, columns] of Object.entries(INDEXES_TO_CREATE)) {
          for (const col of columns) {
            try {
              db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_${col} ON ${table}(${col});`);
            } catch (err) {}
          }
        }
        try {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_inducks_person_numissues ON inducks_person(CAST(numberofindexedissues AS INTEGER));`);
        } catch (err) {}
        db.exec("COMMIT;");
        
        if (processed < files.length) {
          throw new Error(`Seulement ${processed}/${files.length} fichiers ont pu être importés. L'importation a échoué.`);
        }
        
        port.postMessage({ id, type: "success" });
        break;
      }
      
      case "loadCachedDb": {
        if (db) {
          let count = 0;
          try {
             const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
             while(tablesQuery.step()) { count++; }
             tablesQuery.finalize();
          } catch(e) {}
          port.postMessage({ id, type: "success", stats: { size: 100000000, count } });
          break;
        }
        
        let found = false;
        let opfsSupported = false;
        try {
          if (s3.installOpfsSAHPoolVfs) {
            if (!poolUtil) {
              poolUtil = await s3.installOpfsSAHPoolVfs({
                clearOnInit: false
              });
            }
            opfsSupported = true;
          }
        } catch (e) {
          console.warn("OPFS SAH Pool not supported:", e);
        }

        if (opfsSupported) {
          if (poolUtil.getFileCount() > 0) {
             found = true;
             db = new poolUtil.OpfsSAHPoolDb(DB_FILENAME);
          }
        }
        
        if (!found) {
          port.postMessage({ id, type: "not_found" });
          break;
        }
        
        let count = 0;
        try {
           const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
           while(tablesQuery.step()) { count++; }
           tablesQuery.finalize();
        } catch(e) {}
        
        port.postMessage({ id, type: "success", stats: { size: 100000000, count } });
        break;
      }
      
      case "clearCache": {
        if (db) {
           db.close();
           db = null;
        }
        if (poolUtil) {
           poolUtil.removeOpfsSAHPoolFile(DB_FILENAME);
        }
        port.postMessage({ id, type: "success" });
        break;
      }
      
      case "execute": {
        if (!db) throw new Error("Database not loaded");
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
