import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The worker client is a module singleton, so each test re-imports it after
 * resetting the module registry to start from a clean state.
 */
async function freshModule() {
  vi.resetModules();
  return import('../localDb');
}

/** Captures whatever channel the client opened, and lets tests reply to it. */
function makeWorkerHarness() {
  const posted: any[] = [];
  const dedicatedPosted: any[] = [];
  const listeners: Array<(e: any) => void> = [];
  const shared: { onerror?: (e: any) => void; onmessageerror?: (e: any) => void } = {};

  const port = {
    postMessage: (msg: any) => posted.push(msg),
    start: vi.fn(),
    close: vi.fn(),
    set onmessage(fn: (e: any) => void) {
      listeners.push(fn);
    },
    set onmessageerror(fn: (e: any) => void) {
      shared.onmessageerror = fn;
    },
  };

  class MockSharedWorker {
    port = port;
    set onerror(fn: (e: any) => void) {
      shared.onerror = fn;
    }
  }
  class MockWorker {
    postMessage = (msg: any) => {
      posted.push(msg);
      dedicatedPosted.push(msg);
    };
    terminate = vi.fn();
    set onmessage(fn: (e: any) => void) {
      listeners.push(fn);
    }
  }

  /** Simulates a message coming back from the worker. */
  const reply = (data: any) => listeners.forEach((fn) => fn({ data }));

  return { posted, dedicatedPosted, reply, port, shared, MockSharedWorker, MockWorker };
}

describe('localDb worker client', () => {
  let harness: ReturnType<typeof makeWorkerHarness>;

  beforeEach(() => {
    harness = makeWorkerHarness();
    vi.stubGlobal('SharedWorker', harness.MockSharedWorker);
    vi.stubGlobal('Worker', harness.MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports no database before anything is loaded', async () => {
    const { hasLocalDb, getLocalDbStats } = await freshModule();
    expect(hasLocalDb()).toBe(false);
    expect(getLocalDbStats()).toBeNull();
  });

  it('sends an installDb request carrying the source URLs', async () => {
    const { installDatabase } = await freshModule();
    const urls = ['https://example.com/inducks.sqlite.gz'];

    void installDatabase(urls);

    expect(harness.posted).toHaveLength(1);
    expect(harness.posted[0]).toMatchObject({ action: 'installDb', payload: { url: urls } });
  });

  it('sends an installDb request carrying a local File', async () => {
    const { installDatabase } = await freshModule();
    const file = new File(['dummy'], 'inducks.sqlite.gz', { type: 'application/gzip' });

    void installDatabase(file);

    expect(harness.posted[0]).toMatchObject({ action: 'installDb', payload: { file } });
  });

  it('records the stats returned by a successful install', async () => {
    const { installDatabase, hasLocalDb, getLocalDbStats } = await freshModule();

    const promise = installDatabase('https://example.com/db.gz');
    harness.reply({
      id: harness.posted[0].id,
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
    harness.reply({ id: harness.posted[0].id, type: 'error', error: 'error_download|CORS' });

    await expect(promise).rejects.toThrow('error_download|CORS');
    expect(hasLocalDb()).toBe(false);
  });

  it('resolves loadCachedDb to false when the worker finds nothing', async () => {
    const { loadCachedDb, hasLocalDb } = await freshModule();

    const promise = loadCachedDb();
    harness.reply({ id: harness.posted[0].id, type: 'not_found' });

    await expect(promise).resolves.toBe(false);
    expect(hasLocalDb()).toBe(false);
  });

  it('reuses a single in-flight loadCachedDb promise', async () => {
    const { loadCachedDb } = await freshModule();

    const first = loadCachedDb();
    const second = loadCachedDb();

    expect(first).toBe(second);
    expect(harness.posted).toHaveLength(1);
  });

  it('refuses to execute a query while no database is loaded', async () => {
    const { executeLocal } = await freshModule();
    await expect(executeLocal('SELECT 1')).rejects.toThrow('error_not_loaded');
  });

  it('executes a query once a database is available', async () => {
    const { installDatabase, executeLocal } = await freshModule();

    const install = installDatabase('https://example.com/db.gz');
    harness.reply({ id: harness.posted[0].id, type: 'success', stats: { count: 1, size: 1 } });
    await install;

    const query = executeLocal({ sql: 'SELECT ?', args: ['x'] });
    const request = harness.posted[1];
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
    harness.reply({ id: harness.posted[0].id, type: 'success', stats: { count: 1, size: 1 } });
    await install;

    const seen: any[] = [];
    const query = executeLocal('SELECT 1', (row) => seen.push(row));
    const id = harness.posted[1].id;

    expect(harness.posted[1].payload.stream).toBe(true);
    harness.reply({ id, type: 'row', row: { a: 1 } });
    harness.reply({ id, type: 'row', row: { a: 2 } });
    harness.reply({ id, type: 'success', columns: ['a'], count: 2 });

    await query;
    expect(seen).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('prefers a SharedWorker so several tabs can share the OPFS database', async () => {
    const { loadCachedDb } = await freshModule();
    void loadCachedDb();
    expect(harness.port.start).toHaveBeenCalled();
  });

  it('falls back to a dedicated worker when SharedWorker is unavailable', async () => {
    vi.stubGlobal('SharedWorker', undefined);
    const { loadCachedDb } = await freshModule();

    void loadCachedDb();

    expect(harness.port.start).not.toHaveBeenCalled();
    expect(harness.posted[0]).toMatchObject({ action: 'loadCachedDb' });
  });

  describe('when the SharedWorker dies after construction', () => {
    // It fails asynchronously (unsupported module type, blocked script, crash),
    // so a try/catch around the constructor cannot see it. Without a fallback
    // every pending query would hang forever and the local database would look
    // permanently broken.
    it('replays the in-flight request on a dedicated worker', async () => {
      const { loadCachedDb } = await freshModule();

      const promise = loadCachedDb();
      expect(harness.dedicatedPosted).toHaveLength(0);

      harness.shared.onerror?.(new ErrorEvent('error'));

      expect(harness.dedicatedPosted).toHaveLength(1);
      expect(harness.dedicatedPosted[0]).toMatchObject({ action: 'loadCachedDb' });

      harness.reply({ id: harness.dedicatedPosted[0].id, type: 'success', stats: { count: 2, size: 8 } });
      await expect(promise).resolves.toBe(true);
    });

    it('keeps the request id so the reply still matches', async () => {
      const { installDatabase } = await freshModule();

      const promise = installDatabase('https://example.com/db.gz');
      const originalId = harness.posted[0].id;

      harness.shared.onerror?.(new ErrorEvent('error'));

      expect(harness.dedicatedPosted[0].id).toBe(originalId);
      harness.reply({ id: originalId, type: 'success', stats: { count: 1, size: 1 } });
      await expect(promise).resolves.toBeUndefined();
    });

    it('also falls back on a message deserialization error', async () => {
      const { loadCachedDb } = await freshModule();

      void loadCachedDb();
      harness.shared.onmessageerror?.(new MessageEvent('messageerror'));

      expect(harness.dedicatedPosted).toHaveLength(1);
    });

    it('closes the broken port', async () => {
      const { loadCachedDb } = await freshModule();

      void loadCachedDb();
      harness.shared.onerror?.(new ErrorEvent('error'));

      expect(harness.port.close).toHaveBeenCalled();
    });

    it('demotes only once, however many errors arrive', async () => {
      const { loadCachedDb } = await freshModule();

      void loadCachedDb();
      harness.shared.onerror?.(new ErrorEvent('error'));
      harness.shared.onerror?.(new ErrorEvent('error'));
      harness.shared.onmessageerror?.(new MessageEvent('messageerror'));

      expect(harness.dedicatedPosted).toHaveLength(1);
    });
  });

  it('clears its state when the database is unloaded', async () => {
    const { installDatabase, unloadLocalDb, hasLocalDb, getLocalDbStats } = await freshModule();

    const install = installDatabase('https://example.com/db.gz');
    harness.reply({ id: harness.posted[0].id, type: 'success', stats: { count: 3, size: 9 } });
    await install;
    expect(hasLocalDb()).toBe(true);

    unloadLocalDb();

    expect(hasLocalDb()).toBe(false);
    expect(getLocalDbStats()).toBeNull();
    expect(harness.port.close).toHaveBeenCalled();
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
      await Promise.resolve();
      await Promise.resolve();

      expect(persist).toHaveBeenCalled();
    });

    it('does not delay the install request behind the grant', async () => {
      // The grant applies to the origin, so blocking the download on it would
      // only add latency.
      withStorage({ persist: vi.fn(() => new Promise(() => {})), persisted: vi.fn().mockResolvedValue(false) } as any);

      const { installDatabase } = await freshModule();
      void installDatabase('https://example.com/db.gz');

      expect(harness.posted).toHaveLength(1);
    });

    it('re-asserts the grant when a cached database is picked up', async () => {
      const persist = vi.fn().mockResolvedValue(true);
      withStorage({ persist, persisted: vi.fn().mockResolvedValue(false) } as any);

      const { loadCachedDb } = await freshModule();
      const promise = loadCachedDb();
      harness.reply({
        id: harness.posted[0].id,
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
      harness.reply({ id: harness.posted[0].id, type: 'success', stats: { count: 1, size: 1, ...stats } });
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
        id: harness.posted[0].id,
        type: 'success',
        stats: { count: 90, size: 1_133_518_848, storage: 'sah', persistent: true },
      });
      await expect(promise).resolves.toBe(true);

      expect(getLocalDbStats()).toMatchObject({ storage: 'sah', persistent: true, persistGranted: true });
      expect(isLocalDbPersistent()).toBe(true);
    });
  });
});
