import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The client builds its worker through a Vite `?worker` import, so the tests
 * point that default export at a mock they can drive. A hoisted holder lets each
 * test install a fresh worker instance created in `beforeEach` — vi.mock is
 * hoisted above the import and cannot close over per-test state otherwise.
 */
const workerHolder = vi.hoisted(() => ({ create: null as null | (() => any) }));

vi.mock('../dbWorker?worker', () => ({
  default: class {
    constructor() {
      return workerHolder.create!();
    }
  },
}));

/**
 * The worker client is a module singleton, so each test re-imports it after
 * resetting the module registry to start from a clean state.
 */
async function freshModule() {
  vi.resetModules();
  return import('../localDb');
}

/** Captures whatever the client posted, and lets tests reply on its channel. */
function makeWorkerHarness() {
  const posted: any[] = [];
  const listeners: Array<(e: any) => void> = [];
  const instances: MockWorker[] = [];

  class MockWorker {
    postMessage = (msg: any) => {
      posted.push(msg);
    };
    terminate = vi.fn();
    set onmessage(fn: (e: any) => void) {
      listeners.push(fn);
    }
  }

  const create = () => {
    const worker = new MockWorker();
    instances.push(worker);
    return worker;
  };

  /** Simulates a message coming back from the worker. */
  const reply = (data: any) => listeners.forEach((fn) => fn({ data }));

  return { posted, listeners, instances, create, reply };
}

describe('localDb worker client', () => {
  let harness: ReturnType<typeof makeWorkerHarness>;

  beforeEach(() => {
    harness = makeWorkerHarness();
    workerHolder.create = harness.create;
    // No Web Locks in jsdom, but pin it so the client always takes the
    // single-owner dedicated path rather than leader election.
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
  });

  afterEach(() => {
    workerHolder.create = null;
  });

  /**
   * The channel initialises asynchronously (`getChannelAsync().then(post)`), so
   * a posted message only lands after a few microtasks — unlike the old
   * synchronous SharedWorker path. Await it before reading `posted`.
   */
  async function nthPosted(index: number): Promise<any> {
    for (let i = 0; i < 50 && harness.posted.length <= index; i++) {
      await Promise.resolve();
    }
    return harness.posted[index];
  }

  it('reports no database before anything is loaded', async () => {
    const { hasLocalDb, getLocalDbStats } = await freshModule();
    expect(hasLocalDb()).toBe(false);
    expect(getLocalDbStats()).toBeNull();
  });

  it('sends an installDb request carrying the source URLs', async () => {
    const { installDatabase } = await freshModule();
    const urls = ['https://example.com/inducks.sqlite.gz'];

    void installDatabase(urls);

    expect(await nthPosted(0)).toMatchObject({ action: 'installDb', payload: { url: urls } });
  });

  it('sends an installDb request carrying a local File', async () => {
    const { installDatabase } = await freshModule();
    const file = new File(['dummy'], 'inducks.sqlite.gz', { type: 'application/gzip' });

    void installDatabase(file);

    expect(await nthPosted(0)).toMatchObject({ action: 'installDb', payload: { file } });
  });

  it('records the stats returned by a successful install', async () => {
    const { installDatabase, hasLocalDb, getLocalDbStats } = await freshModule();

    const promise = installDatabase('https://example.com/db.gz');
    harness.reply({
      id: (await nthPosted(0)).id,
      type: 'success',
      stats: { count: 42, size: 1024, storage: 'sah', persistent: true },
    });
    await promise;

    expect(hasLocalDb()).toBe(true);
    expect(getLocalDbStats()).toMatchObject({ count: 42, size: 1024, storage: 'sah', persistent: true });
  });

  it('rejects an install the worker could not complete', async () => {
    const { installDatabase, hasLocalDb } = await freshModule();

    const promise = installDatabase('https://example.com/db.gz');
    harness.reply({ id: (await nthPosted(0)).id, type: 'error', error: 'error_download|CORS' });

    await expect(promise).rejects.toThrow('error_download|CORS');
    expect(hasLocalDb()).toBe(false);
  });

  it('resolves loadCachedDb to false when the worker finds nothing', async () => {
    const { loadCachedDb, hasLocalDb } = await freshModule();

    const promise = loadCachedDb();
    harness.reply({ id: (await nthPosted(0)).id, type: 'not_found' });

    await expect(promise).resolves.toBe(false);
    expect(hasLocalDb()).toBe(false);
  });

  /**
   * Editing the address bar reloads the page while the outgoing document is
   * still holding the OPFS exclusive access handles. The new worker then falls
   * back to the memory VFS and reports "not found" for a database that is very
   * much installed — which used to be cached as a permanent verdict, so the app
   * asked the user to re-import a gigabyte.
   */
  describe('when the persistent backend is momentarily unavailable', () => {
    // The backoff between attempts uses real timers, so drive them by hand.
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('retries and picks the database up once the handles are released', async () => {
      const { loadCachedDb, hasLocalDb } = await freshModule();

      const promise = loadCachedDb();
      harness.reply({
        id: (await nthPosted(0)).id,
        type: 'not_found',
        storage: 'memory',
        storageError: 'access handle held by another client',
      });

      // First backoff step is 150 ms; advancing it fires the second attempt.
      await vi.advanceTimersByTimeAsync(150);
      const retry = harness.posted[1];
      expect(retry).toMatchObject({ action: 'loadCachedDb' });

      harness.reply({ id: retry.id, type: 'success', stats: { count: 7, size: 32 } });
      await expect(promise).resolves.toBe(true);
      expect(hasLocalDb()).toBe(true);
    });

    it('gives up after the backoff is exhausted', async () => {
      const { loadCachedDb } = await freshModule();

      const promise = loadCachedDb();
      harness.reply({ id: (await nthPosted(0)).id, type: 'not_found', storage: 'memory' });

      for (let i = 1; i < CACHED_DB_BACKOFFS_MS.length + 1; i++) {
        await vi.advanceTimersByTimeAsync(CACHED_DB_BACKOFFS_MS[i - 1]);
        harness.reply({ id: harness.posted[i].id, type: 'not_found', storage: 'memory' });
      }

      await expect(promise).resolves.toBe(false);
      // Initial attempt plus one per backoff step, then it stops.
      expect(harness.posted).toHaveLength(CACHED_DB_BACKOFFS_MS.length + 1);
    });

    it('does not retry a database that genuinely was never installed', async () => {
      const { loadCachedDb } = await freshModule();

      const promise = loadCachedDb();
      harness.reply({ id: (await nthPosted(0)).id, type: 'not_found', storage: 'sah' });

      await expect(promise).resolves.toBe(false);
      // A `sah` verdict is authoritative: no second attempt is ever posted.
      await Promise.resolve();
      expect(harness.posted).toHaveLength(1);
    });
  });

  it('does not cache a failed load, so a later call tries again', async () => {
    const { loadCachedDb } = await freshModule();

    const first = loadCachedDb();
    harness.reply({ id: (await nthPosted(0)).id, type: 'not_found', storage: 'sah' });
    await expect(first).resolves.toBe(false);

    const second = loadCachedDb();
    expect(second).not.toBe(first);

    harness.reply({ id: (await nthPosted(1)).id, type: 'success', stats: { count: 1, size: 1 } });
    await expect(second).resolves.toBe(true);
  });

  it('announces a successful load so the gated UI refreshes', async () => {
    const { loadCachedDb } = await freshModule();
    const listener = vi.fn();
    window.addEventListener('db-local-loaded', listener);

    const promise = loadCachedDb();
    harness.reply({ id: (await nthPosted(0)).id, type: 'success', stats: { count: 1, size: 1 } });
    await promise;

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('db-local-loaded', listener);
  });

  it('reuses a single in-flight loadCachedDb promise', async () => {
    const { loadCachedDb } = await freshModule();

    const first = loadCachedDb();
    const second = loadCachedDb();

    expect(first).toBe(second);
    await nthPosted(0);
    expect(harness.posted).toHaveLength(1);
  });

  it('refuses to execute a query once the worker confirms there is no database', async () => {
    const { executeLocal } = await freshModule();

    // A query that beats the boot-time load opens the cached database itself,
    // so a component mounting straight onto a deep link is not left empty.
    const query = executeLocal('SELECT 1');
    expect(await nthPosted(0)).toMatchObject({ action: 'loadCachedDb' });

    harness.reply({ id: harness.posted[0].id, type: 'not_found', storage: 'sah' });
    await expect(query).rejects.toThrow('error_not_loaded');
  });

  it('runs a query issued before the database finished loading', async () => {
    const { executeLocal } = await freshModule();

    const query = executeLocal('SELECT 1');
    harness.reply({ id: (await nthPosted(0)).id, type: 'success', stats: { count: 1, size: 1 } });

    const request = await nthPosted(1);
    expect(request).toMatchObject({ action: 'execute', payload: { sql: 'SELECT 1' } });
    harness.reply({ id: request.id, type: 'success', rows: [{ a: 1 }], columns: ['a'] });
    await expect(query).resolves.toEqual({ rows: [{ a: 1 }], columns: ['a'] });
  });

  it('executes a query once a database is available', async () => {
    const { installDatabase, executeLocal } = await freshModule();

    const install = installDatabase('https://example.com/db.gz');
    harness.reply({ id: (await nthPosted(0)).id, type: 'success', stats: { count: 1, size: 1 } });
    await install;

    const query = executeLocal({ sql: 'SELECT ?', args: ['x'] });
    const request = await nthPosted(1);
    expect(request).toMatchObject({
      action: 'execute',
      payload: { sql: 'SELECT ?', args: ['x'], stream: false },
    });

    harness.reply({ id: request.id, type: 'success', rows: [{ a: 1 }], columns: ['a'] });
    await expect(query).resolves.toEqual({ rows: [{ a: 1 }], columns: ['a'] });
  });

  it('streams rows to the callback instead of buffering them', async () => {
    const { installDatabase, executeLocal } = await freshModule();

    const install = installDatabase('https://example.com/db.gz');
    harness.reply({ id: (await nthPosted(0)).id, type: 'success', stats: { count: 1, size: 1 } });
    await install;

    const seen: any[] = [];
    const query = executeLocal('SELECT 1', (row) => seen.push(row));
    const request = await nthPosted(1);

    expect(request.payload.stream).toBe(true);
    harness.reply({ id: request.id, type: 'row', row: { a: 1 } });
    harness.reply({ id: request.id, type: 'row', row: { a: 2 } });
    harness.reply({ id: request.id, type: 'success', columns: ['a'], count: 2 });

    await query;
    expect(seen).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('clears its state when the database is unloaded', async () => {
    const { installDatabase, unloadLocalDb, hasLocalDb, getLocalDbStats } = await freshModule();

    const install = installDatabase('https://example.com/db.gz');
    harness.reply({ id: (await nthPosted(0)).id, type: 'success', stats: { count: 3, size: 9 } });
    await install;
    expect(hasLocalDb()).toBe(true);

    unloadLocalDb();

    expect(hasLocalDb()).toBe(false);
    expect(getLocalDbStats()).toBeNull();
    // Disposing the leader's channel terminates its worker.
    expect(harness.instances[0].terminate).toHaveBeenCalled();
  });

  describe('persistent storage', () => {
    // Without this grant the origin sits in the best-effort bucket and browsers
    // evict a ~1 GB database under storage pressure — the cause of the repeated
    // re-imports users were seeing.
    const withStorage = (impl: Partial<StorageManager>) => {
      Object.defineProperty(navigator, 'storage', { value: impl, configurable: true });
    };

    afterEach(() => {
      Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    });

    it('asks the browser to persist storage', async () => {
      const persist = vi.fn().mockResolvedValue(true);
      withStorage({ persist, persisted: vi.fn().mockResolvedValue(false) } as any);

      const { requestPersistentStorage } = await freshModule();
      await expect(requestPersistentStorage()).resolves.toBe(true);
      expect(persist).toHaveBeenCalled();
    });

    it('does not ask again once already granted', async () => {
      const persist = vi.fn();
      withStorage({ persist, persisted: vi.fn().mockResolvedValue(true) } as any);

      const { requestPersistentStorage } = await freshModule();
      await expect(requestPersistentStorage()).resolves.toBe(true);
      expect(persist).not.toHaveBeenCalled();
    });

    it('reports a refusal without throwing', async () => {
      withStorage({ persist: vi.fn().mockResolvedValue(false), persisted: vi.fn().mockResolvedValue(false) } as any);

      const { requestPersistentStorage } = await freshModule();
      await expect(requestPersistentStorage()).resolves.toBe(false);
    });

    it('survives a browser without the Storage API', async () => {
      const { requestPersistentStorage } = await freshModule();
      await expect(requestPersistentStorage()).resolves.toBe(false);
    });

    it('swallows an error from the browser', async () => {
      withStorage({ persist: vi.fn().mockRejectedValue(new Error('nope')), persisted: vi.fn().mockResolvedValue(false) } as any);

      const { requestPersistentStorage } = await freshModule();
      await expect(requestPersistentStorage()).resolves.toBe(false);
    });

    it('requests persistence when installing a database', async () => {
      const persist = vi.fn().mockResolvedValue(true);
      withStorage({ persist, persisted: vi.fn().mockResolvedValue(false) } as any);

      const { installDatabase } = await freshModule();
      void installDatabase('https://example.com/db.gz');
      // The grant is requested without being awaited, so let its promise settle.
      await nthPosted(0);
      await Promise.resolve();

      expect(persist).toHaveBeenCalled();
    });

    it('does not delay the install request behind the grant', async () => {
      // The grant applies to the origin, so blocking the download on it would
      // only add latency.
      withStorage({ persist: vi.fn(() => new Promise(() => {})), persisted: vi.fn().mockResolvedValue(false) } as any);

      const { installDatabase } = await freshModule();
      void installDatabase('https://example.com/db.gz');

      expect(await nthPosted(0)).toMatchObject({ action: 'installDb' });
    });

    it('re-asserts the grant when a cached database is picked up', async () => {
      const persist = vi.fn().mockResolvedValue(true);
      withStorage({ persist, persisted: vi.fn().mockResolvedValue(false) } as any);

      const { loadCachedDb } = await freshModule();
      const promise = loadCachedDb();
      harness.reply({
        id: (await nthPosted(0)).id,
        type: 'success',
        stats: { count: 5, size: 10, storage: 'sah', persistent: true },
      });
      await promise;

      expect(persist).toHaveBeenCalled();
    });
  });

  /**
   * Regression guards for the failure users actually hit: an import that
   * reports success and is gone on the next visit. Two independent causes —
   * the worker silently falling back to the in-memory VFS, and the browser
   * refusing the persistence grant so a ~1 GB store gets evicted — must both
   * be visible to the UI.
   */
  describe('durability of an installed database', () => {
    const withStorage = (impl: Partial<StorageManager>) => {
      Object.defineProperty(navigator, 'storage', { value: impl, configurable: true });
    };
    const granted = () =>
      withStorage({ persist: vi.fn().mockResolvedValue(true), persisted: vi.fn().mockResolvedValue(true) } as any);

    afterEach(() => {
      Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    });

    /** Installs a database, letting the worker describe its storage backend. */
    async function install(stats: Record<string, unknown>) {
      const mod = await freshModule();
      const promise = mod.installDatabase('https://example.com/db.gz');
      harness.reply({ id: (await nthPosted(0)).id, type: 'success', stats: { count: 1, size: 1, ...stats } });
      await promise;
      return mod;
    }

    it('treats an OPFS-backed database as durable', async () => {
      granted();
      const { isLocalDbPersistent, getLocalDbStats } = await install({ storage: 'sah', persistent: true });

      expect(getLocalDbStats()?.storage).toBe('sah');
      expect(isLocalDbPersistent()).toBe(true);
    });

    it('flags a database that only lives in memory', async () => {
      granted();
      const { isLocalDbPersistent, getLocalDbStats } = await install({
        storage: 'memory',
        persistent: false,
        storageError: 'SAH pool unavailable',
      });

      expect(isLocalDbPersistent()).toBe(false);
      expect(getLocalDbStats()?.storageError).toBe('SAH pool unavailable');
    });

    it('flags a persistent backend the browser refuses to protect', async () => {
      withStorage({ persist: vi.fn().mockResolvedValue(false), persisted: vi.fn().mockResolvedValue(false) } as any);
      const { isLocalDbPersistent, getLocalDbStats } = await install({ storage: 'sah', persistent: true });

      expect(getLocalDbStats()?.persistGranted).toBe(false);
      expect(isLocalDbPersistent()).toBe(false);
    });

    it('does not claim durability before anything is installed', async () => {
      const { isLocalDbPersistent } = await freshModule();
      expect(isLocalDbPersistent()).toBe(false);
    });

    it('assumes the worst from a worker that reports no storage backend', async () => {
      // An older worker bundle cached by the service worker sends bare stats.
      granted();
      const { isLocalDbPersistent, getLocalDbStats } = await install({});

      expect(getLocalDbStats()?.storage).toBe('memory');
      expect(isLocalDbPersistent()).toBe(false);
    });

    it('keeps the backend reported for a database restored from cache', async () => {
      granted();
      const { loadCachedDb, getLocalDbStats, isLocalDbPersistent } = await freshModule();

      const promise = loadCachedDb();
      harness.reply({
        id: (await nthPosted(0)).id,
        type: 'success',
        stats: { count: 90, size: 1_133_518_848, storage: 'sah', persistent: true },
      });
      await expect(promise).resolves.toBe(true);

      expect(getLocalDbStats()).toMatchObject({ storage: 'sah', persistent: true, persistGranted: true });
      expect(isLocalDbPersistent()).toBe(true);
    });
  });
});

/** Backoff steps between cached-load attempts, mirroring CACHED_DB_RETRY_DELAYS_MS. */
const CACHED_DB_BACKOFFS_MS = [150, 400, 1000, 2000, 3000, 5000];
