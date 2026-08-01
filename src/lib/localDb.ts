import DbWorker from './dbWorker?sharedworker';

let workerInst: any = null;
let workerPort: MessagePort | Worker | null = null;
let queryIdCounter = 0;
const pendingQueries = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void, onRow?: (row: any) => void }>();
let onProgressCallback: ((progress: { table: string; current: number; total: number; percent: number }) => void) | null = null;

function getWorker(): any {
  if (!workerPort) {
    workerInst = new DbWorker();
    
    if (workerInst.port) {
      workerPort = workerInst.port;
      (workerPort as MessagePort).onmessage = handleMessage;
      (workerPort as MessagePort).start();
    } else {
      workerPort = workerInst as Worker;
      (workerPort as Worker).onmessage = handleMessage;
    }
  }
  return workerPort;
}

function handleMessage(e: MessageEvent) {
  const { id, type, error, row, rows, count, table, current, total, percent } = e.data;
  
  if (type === 'progress' && onProgressCallback) {
    onProgressCallback({ table, current, total, percent: percent || 0 });
    return;
  }
  
  const pending = pendingQueries.get(id);
  if (pending) {
    if (type === 'row' && pending.onRow) {
      pending.onRow(row);
      return;
    }
    
    if (type === 'error') {
      pending.reject(new Error(error));
    } else if (type === 'success') {
      pending.resolve(rows ? { rows, columns: e.data.columns } : { rows: [], columns: e.data.columns, count, stats: e.data.stats });
    } else if (type === 'not_found') {
      pending.resolve(null);
    }
    pendingQueries.delete(id);
  }
}

export async function loadLocalDb(file: File): Promise<void> {
  throw new Error("loadLocalDb for direct sqlite file is not implemented in worker yet.");
}

let localDbStats: { count: number, size: number } | null = null;

export function hasLocalDb(): boolean {
  return workerPort !== null && localDbStats !== null;
}

export function getLocalDbStats() {
  return localDbStats;
}

export async function loadFromIsvFiles(files: File[], onProgress?: (progress: {table: string, current: number, total: number, percent: number}) => void): Promise<void> {
  const w = getWorker();
  onProgressCallback = onProgress || null;
  
  localDbStats = {
    count: files.length,
    size: files.reduce((acc, f) => acc + f.size, 0)
  };
  
  return new Promise((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, { resolve, reject });
    w.postMessage({
      id,
      action: "loadIsv",
      payload: { files, baseUrl: import.meta.env.BASE_URL }
    });
  });
}

/**
 * Loads the Inducks database by downloading ISV files from cloud URLs (e.g. GitHub Releases).
 * Each asset is an object `{ name, url }` which the worker will fetch() and stream on-the-fly.
 * @param assets - Array of { name: string, url: string } objects pointing to .isv files
 * @param onProgress - Optional callback for progress updates
 */
export async function loadFromCloud(
  assets: { name: string; url: string; size?: number }[],
  onProgress?: (progress: {table: string, current: number, total: number, percent: number}) => void
): Promise<void> {
  const w = getWorker();
  onProgressCallback = onProgress || null;

  localDbStats = {
    count: assets.length,
    size: assets.reduce((acc, a) => acc + (a.size || 0), 0)
  };

  return new Promise((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, { resolve, reject });
    w.postMessage({
      id,
      action: "loadIsv",
      payload: { files: assets, baseUrl: import.meta.env.BASE_URL }
    });
  });
}


export function unloadLocalDb() {
  if (workerPort) {
    workerPort.postMessage({ id: ++queryIdCounter, action: "unload", payload: {} });
    if (workerInst instanceof Worker) {
      workerInst.terminate();
    }
    workerPort = null;
    workerInst = null;
    localDbStats = null;
  }
}

let dbLoadPromise: Promise<boolean> | null = null;

export async function loadCachedDb(): Promise<boolean> {
  if (dbLoadPromise) return dbLoadPromise;

  const w = getWorker();
  
  dbLoadPromise = new Promise((resolve) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, {
      resolve: (data) => {
        if (data && data.stats) {
          localDbStats = { count: data.stats.count, size: data.stats.size };
          resolve(true);
        } else {
          resolve(false);
        }
      },
      reject: () => resolve(false)
    });
    
    w.postMessage({
      id,
      action: "loadCachedDb",
      payload: { baseUrl: import.meta.env.BASE_URL }
    });
  });
  
  return dbLoadPromise;
}

export async function clearLocalDbCache(): Promise<void> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, { resolve, reject });
    w.postMessage({ id, action: "clearCache", payload: {} });
  });
}

export async function executeLocal(query: { sql: string, args?: any[] } | string, onRow?: (row: any) => void) {
  if (dbLoadPromise) {
    await dbLoadPromise;
  }
  if (!workerPort) throw new Error("Local database is not loaded.");
  
  const sqlString = typeof query === "string" ? query : query.sql;
  const args = typeof query === "string" ? [] : (query.args || []);
  
  return new Promise<any>((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, { resolve, reject, onRow });
    
    workerPort!.postMessage({
      id,
      action: "execute",
      payload: { sql: sqlString, args, stream: !!onRow }
    });
  });
}
