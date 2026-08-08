import DedicatedDbWorker from './dbWorker?worker';
import SharedDbWorker from './dbWorker?sharedworker';

/**
 * Client side of the SQLite worker.
 *
 * A **SharedWorker** is used whenever the browser supports it: the OPFS
 * SAH-pool VFS takes exclusive access handles on its files, so two tabs each
 * running their own dedicated worker cannot open the same database — the
 * second tab silently ends up with no data. Routing every tab through one
 * shared worker keeps a single owner of those handles.
 *
 * Browsers without SharedWorker (notably Chrome on Android) fall back to a
 * dedicated worker, which works fine as long as only one tab is open.
 */

interface WorkerChannel {
  post: (message: any) => void;
  dispose: () => void;
  /** True for the SharedWorker channel, which may still fall back. */
  shared: boolean;
}

let channel: WorkerChannel | null = null;
let queryIdCounter = 0;

type Pending = {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  onRow?: (row: any) => void;
  /** Kept so the request can be replayed if the channel dies. */
  message: any;
};
const pendingQueries = new Map<number, Pending>();

let onProgressCallback: ((progress: InstallProgressEvent) => void) | null = null;

interface InstallProgressEvent {
  step: string;
  current: number;
  total: number;
  percent: number;
}

function handleMessage(e: MessageEvent) {
  const { id, type, error, row, rows, count, step, current, total, percent } = e.data ?? {};

  if (type === 'progress') {
    onProgressCallback?.({ step, current: current ?? 0, total: total ?? 0, percent: percent ?? 0 });
    return;
  }

  const pending = pendingQueries.get(id);
  if (!pending) return;

  if (type === 'row') {
    // Streaming result: more rows follow, keep the entry alive.
    pending.onRow?.(row);
    return;
  }

  if (type === 'error') {
    pending.reject(new Error(error));
  } else if (type === 'success') {
    pending.resolve(
      rows
        ? { rows, columns: e.data.columns }
        : { rows: [], columns: e.data.columns, count, stats: e.data.stats }
    );
  } else if (type === 'not_found') {
    // Carries the worker's storage verdict: "no database" and "the persistent
    // backend would not open" arrive through the same message, and only the
    // second one is worth retrying.
    pending.resolve({ notFound: true, storage: e.data.storage, storageError: e.data.storageError });
  }
  pendingQueries.delete(id);
}

function createDedicatedChannel(): WorkerChannel {
  const dedicated = new DedicatedDbWorker();
  dedicated.onmessage = handleMessage;
  return {
    post: (message) => dedicated.postMessage(message),
    dispose: () => dedicated.terminate(),
    shared: false,
  };
}

/**
 * A SharedWorker can also fail *after* construction — an unsupported module
 * type, a blocked script, a crash. That surfaces as an async `error` event
 * rather than a throw, and would otherwise leave every pending query hanging
 * forever. Switch to a dedicated worker and replay what was in flight.
 */
function demoteToDedicatedWorker(reason: unknown) {
  if (!channel?.shared) return;
  console.warn('SharedWorker failed, falling back to a dedicated worker:', reason);

  try {
    channel.dispose();
  } catch {
    /* the channel is already broken */
  }
  channel = createDedicatedChannel();

  for (const [id, pending] of pendingQueries) {
    channel.post({ id, ...pending.message });
  }
}

function createChannel(): WorkerChannel {
  if (typeof SharedWorker !== 'undefined') {
    try {
      const shared = new SharedDbWorker();
      shared.port.onmessage = handleMessage;
      shared.port.onmessageerror = (e: unknown) => demoteToDedicatedWorker(e);
      // Fires when the worker script itself cannot run.
      (shared as unknown as AbstractWorker).onerror = (e: unknown) => demoteToDedicatedWorker(e);
      shared.port.start();
      return {
        post: (message) => shared.port.postMessage(message),
        dispose: () => shared.port.close(),
        shared: true,
      };
    } catch (err) {
      console.warn('SharedWorker unavailable, falling back to a dedicated worker:', err);
    }
  }

  return createDedicatedChannel();
}

function getChannel(): WorkerChannel {
  if (!channel) channel = createChannel();
  return channel;
}

/** Sends a request to the worker and resolves with its reply. */
function request(payload: Record<string, any>, onRow?: (row: any) => void): Promise<any> {
  const target = getChannel();
  return new Promise((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, { resolve, reject, onRow, message: payload });
    target.post({ id, ...payload });
  });
}

export interface LocalDbStats {
  count: number;
  size: number;
  /** Backend the database lives on: only `opfs`/`sah` survive a reload. */
  storage: 'opfs' | 'sah' | 'memory';
  /** False when the database is held in memory and will die with the tab. */
  persistent: boolean;
  /** Why the persistent backend was unavailable, when it was. */
  storageError?: string;
  /** Result of `navigator.storage.persist()`; null while unknown. */
  persistGranted: boolean | null;
}

let localDbStats: LocalDbStats | null = null;

/** Normalises a worker stats payload, tolerating older workers. */
function toStats(raw: any, persistGranted: boolean | null): LocalDbStats {
  return {
    count: raw.count ?? 0,
    size: raw.size ?? 0,
    storage: raw.storage ?? 'memory',
    persistent: raw.persistent ?? false,
    storageError: raw.storageError,
    persistGranted,
  };
}

export function hasLocalDb(): boolean {
  return channel !== null && localDbStats !== null;
}

export function getLocalDbStats(): LocalDbStats | null {
  return localDbStats;
}

/**
 * Whether the installed database can be expected to still be there next time.
 *
 * Two independent things have to hold: the database must sit on a persistent
 * backend at all, and the origin must have been granted persistent storage —
 * without the grant a ~1 GB store is the first thing browsers evict, which is
 * what made imports "disappear".
 */
export function isLocalDbPersistent(): boolean {
  return !!localDbStats?.persistent && localDbStats.persistGranted !== false;
}

/**
 * Asks the browser to keep the OPFS data.
 *
 * Without this the origin sits in the "best-effort" storage bucket, which
 * browsers evict under storage pressure — that is what made an imported
 * database disappear and forced a re-import. The request is idempotent and
 * silently unavailable in some browsers, so failure is never fatal.
 *
 * Returns whether storage is persistent after the call.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn("Could not request persistent storage:", err);
    return false;
  }
}

/**
 * Requests the grant and records it on the current stats, so the UI can warn
 * about an install that is not safe from eviction.
 */
async function refreshPersistGrant(): Promise<boolean> {
  const granted = await requestPersistentStorage();
  if (localDbStats) localDbStats = { ...localDbStats, persistGranted: granted };
  return granted;
}

export async function installDatabase(
  source: string | string[] | File,
  onProgress?: (progress: InstallProgressEvent) => void
): Promise<void> {
  onProgressCallback = onProgress ?? null;

  // A ~1 GB database is exactly the kind of payload eviction targets first.
  // Not awaited here: the grant applies to the origin, so it need not precede
  // the write, and blocking on it would delay the download for no benefit.
  // Its verdict is folded into the stats once the install lands.
  const grant = requestPersistentStorage();

  const payload = source instanceof File ? { file: source } : { url: source };

  try {
    const data = await request({ action: 'installDb', payload });
    if (!data?.stats) throw new Error('error_validation|Database installation failed.');
    localDbStats = toStats(data.stats, null);
    localDbStats = { ...localDbStats, persistGranted: await grant };
  } finally {
    onProgressCallback = null;
  }
}

export function unloadLocalDb() {
  if (!channel) return;
  channel.post({ id: ++queryIdCounter, action: 'unload', payload: {} });
  channel.dispose();
  channel = null;
  localDbStats = null;
  dbLoadPromise = null;
}

let dbLoadPromise: Promise<boolean> | null = null;

/**
 * Backoff between attempts to reopen the cached database.
 *
 * The OPFS SAH pool takes *exclusive* access handles. When the address bar is
 * edited, the browser starts the new document while the outgoing one is still
 * alive, so the new worker can find the handles held by a client that is about
 * to disappear. That window is short — retrying a few times covers it, whereas
 * giving up made an installed database look uninstalled.
 */
const CACHED_DB_RETRY_DELAYS_MS = [150, 400, 1000];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function openCachedDb(): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    let retryable = false;

    try {
      const data = await request({
        action: 'loadCachedDb',
        payload: { baseUrl: import.meta.env.BASE_URL },
      });

      if (data?.stats) {
        localDbStats = toStats(data.stats, null);
        // Re-assert the grant on every boot: it can be revoked when the user
        // clears site data, and a store that is not persisted gets evicted.
        await refreshPersistGrant();
        return true;
      }

      // Falling back to the memory VFS means the persistent backend never
      // opened, so "not found" says nothing about whether a database exists.
      // A genuine first visit reports `sah`/`opfs` and is not retried.
      retryable = data?.storage === 'memory';
    } catch {
      // The channel died mid-request; the replacement worker deserves a go.
      retryable = true;
    }

    if (!retryable || attempt >= CACHED_DB_RETRY_DELAYS_MS.length) return false;
    await delay(CACHED_DB_RETRY_DELAYS_MS[attempt]);
  }
}

// Not `async`: callers (and `executeLocal`) rely on getting the very same
// promise back, so a concurrent page load only ever asks the worker once.
export function loadCachedDb(): Promise<boolean> {
  if (dbLoadPromise) return dbLoadPromise;

  dbLoadPromise = openCachedDb().then((loaded) => {
    if (loaded) {
      // Fired here rather than by the caller so every entry point — boot, or a
      // query that had to open the database itself — refreshes the UI.
      window.dispatchEvent(new Event('db-local-loaded'));
    } else {
      // A failure is never memoised: the handles may free up a moment later,
      // and the next query has to be able to try again.
      dbLoadPromise = null;
    }
    return loaded;
  });

  return dbLoadPromise;
}

export async function clearLocalDbCache(): Promise<void> {
  await request({ action: 'clearCache', payload: {} });
  localDbStats = null;
}

export async function executeLocal(
  query: { sql: string; args?: any[] } | string,
  onRow?: (row: any) => void
) {
  // Queries must wait for the boot-time load instead of failing outright — and
  // start one themselves when they beat it, which is what a component mounting
  // straight onto a deep link does.
  if (!hasLocalDb()) await loadCachedDb();

  if (!hasLocalDb()) throw new Error('error_not_loaded');

  const sql = typeof query === 'string' ? query : query.sql;
  const args = typeof query === 'string' ? [] : query.args ?? [];

  return request({ action: 'execute', payload: { sql, args, stream: !!onRow } }, onRow);
}
