import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The OCR client must reach whichever transcript API the build points at — the
 * local server through the dev proxy, or the hosted API with its key — and treat
 * an unreachable API as "no OCR filter", never as an error.
 */

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return import('../ocrService');
}

const apiResponse = {
  total: 3,
  entries: [
    { key: 'br/AD   22b', entrycode: 'br/AD   22b', issuecode: 'br/AD   22', title: 'T', hits: 2, pages: [3, 4], firstSnippet: 's', maxConfidence: 0.9 },
    { key: 'br/AD   15', entrycode: null, issuecode: 'br/AD   15', title: null, hits: 1, pages: [7], firstSnippet: '', maxConfidence: 0.8 },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('searchOcr', () => {
  it('uses the dev proxy and no key by default', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(apiResponse)));
    vi.stubGlobal('fetch', fetch);
    const { searchOcr, ocrHosted } = await load({ VITE_TRANSCRIPT_API: '', VITE_TRANSCRIPT_API_KEY: '' });

    const r = await searchOcr('tio patinhas');
    expect(ocrHosted).toBe(false);
    expect(fetch.mock.calls[0][0]).toBe('/api/transcript/search?q=tio%20patinhas&entries=1&limit=1000');
    expect(fetch.mock.calls[0][1].headers).toBeUndefined();
    expect(r?.entrycodes).toEqual(['br/AD   22b', 'br/AD   15']);
    expect(r?.issuecodes).toEqual(['br/AD   22', 'br/AD   15']);
  });

  it('calls the hosted API with its key when configured', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(apiResponse)));
    vi.stubGlobal('fetch', fetch);
    const { searchOcr, ocrHosted } = await load({
      VITE_TRANSCRIPT_API: 'https://transcript-api.example.workers.dev/api/',
      VITE_TRANSCRIPT_API_KEY: 'tk_test',
    });

    await searchOcr('fetiche');
    expect(ocrHosted).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('https://transcript-api.example.workers.dev/api/search?q=fetiche&entries=1&limit=1000');
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'X-API-Key': 'tk_test' });
  });

  it('returns null when the API refuses or is unreachable', async () => {
    const { searchOcr } = await load({ VITE_TRANSCRIPT_API: 'https://x.example/api', VITE_TRANSCRIPT_API_KEY: 'tk_bad' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"Unknown or revoked API key"}', { status: 401 })));
    expect(await searchOcr('x')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await searchOcr('x')).toBeNull();
  });
});
