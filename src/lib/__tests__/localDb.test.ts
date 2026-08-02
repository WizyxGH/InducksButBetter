import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installDatabase, hasLocalDb, getLocalDbStats, unloadLocalDb } from '../localDb';

describe('localDb client wrapper', () => {
  let mockPort: any;
  let mockWorkerInstance: any;

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    });

    mockPort = {
      postMessage: vi.fn(),
      start: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    mockWorkerInstance = {
      port: mockPort,
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // A constructor returning the mock instance
    const MockConstructor = vi.fn().mockImplementation(function() {
      return mockWorkerInstance;
    });

    vi.stubGlobal('Worker', MockConstructor);
    vi.stubGlobal('SharedWorker', MockConstructor);
  });

  afterEach(() => {
    unloadLocalDb();
    vi.unstubAllGlobals();
  });

  it('initially has no local db', () => {
    expect(hasLocalDb()).toBe(false);
    expect(getLocalDbStats()).toBeNull();
  });

  it('correctly posts installDb message to worker with a URL', async () => {
    const installPromise = installDatabase('https://example.com/inducks.sqlite.gz');

    // Verify mockPort.postMessage was called with installDb action
    expect(mockPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'installDb',
        payload: { url: 'https://example.com/inducks.sqlite.gz' }
      })
    );
  });

  it('correctly posts installDb message to worker with a File', async () => {
    const file = new File(['dummy-content'], 'inducks.sqlite.gz', { type: 'application/gzip' });
    const installPromise = installDatabase(file);

    // Verify mockPort.postMessage was called with installDb action
    expect(mockPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'installDb',
        payload: { file }
      })
    );
  });
});
