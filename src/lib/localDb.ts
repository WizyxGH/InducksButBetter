import DbWorker from './dbWorker?worker';

let workerInst: any = null;
let workerPort: Worker | null = null;
let queryIdCounter = 0;
const pendingQueries = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void, onRow?: (row: any) => void }>();
let onProgressCallback: ((progress: { step: string; current: number; total: number; percent: number }) => void) | null = null;

function getWorker(): Worker {
  if (!workerPort) {
    workerInst = new DbWorker();
    workerPort = workerInst as Worker;
    workerPort.onmessage = handleMessage;
  }
  return workerPort;
}

function handleMessage(e: MessageEvent) {
  const { id, type, error, row, rows, count, step, current, total, percent } = e.data;
  
  if (type === 'progress' && onProgressCallback) {
    onProgressCallback({ step, current: current || 0, total: total || 0, percent: percent || 0 } as any);
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

let localDbStats: { count: number, size: number } | null = null;

export function hasLocalDb(): boolean {
  return workerPort !== null && localDbStats !== null;
}

export function getLocalDbStats() {
  return localDbStats;
}

export async function installDatabase(
  source: string | string[] | File,
  onProgress?: (progress: { step: string; current: number; total: number; percent: number }) => void
): Promise<void> {
  const w = getWorker();
  onProgressCallback = onProgress || null;

  const payload: any = {};
  if (source instanceof File) {
    payload.file = source;
  } else {
    payload.url = source;
  }

  localDbStats = {
    count: 0,
    size: source instanceof File ? source.size : 0
  };

  return new Promise((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, {
      resolve: (data) => {
        if (data && data.stats) {
          localDbStats = { count: data.stats.count, size: data.stats.size };
          resolve();
        } else {
          reject(new Error("Database installation failed."));
        }
      },
      reject
    });
    w.postMessage({
      id,
      action: "installDb",
      payload
    });
  });
}


export function unloadLocalDb() {
  if (workerPort) {
    workerPort.postMessage({ id: ++queryIdCounter, action: "unload", payload: {} });
    if (workerInst) {
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
