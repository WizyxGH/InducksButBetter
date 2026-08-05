import { describe, it, expect, vi } from 'vitest';
import {
  DB_ASSET_NAME,
  GITHUB_RELEASE_API,
  describeInstallError,
  describeInstallProgress,
  formatBytes,
  resolveDatabaseSources,
} from '../dbInstall';

/** Stand-in for i18next's `t`, echoing the key and its interpolation values. */
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;

describe('resolveDatabaseSources', () => {
  it('tries the bundled copy first so a same-origin file avoids CORS entirely', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ assets: [] }));
    const urls = await resolveDatabaseSources('/InducksButBetter/', 'https://example.org/', fetchImpl);

    expect(urls[0]).toBe(`https://example.org/InducksButBetter/datas/${DB_ASSET_NAME}`);
  });

  it('prefers the GitHub API asset URL over browser_download_url', async () => {
    // github.com sends no CORS headers on its 302, so browser_download_url
    // fails in the browser; api.github.com works and must come first.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        assets: [
          {
            name: DB_ASSET_NAME,
            url: 'https://api.github.com/repos/o/r/releases/assets/1',
            browser_download_url: 'https://github.com/o/r/releases/download/datas/db.gz',
          },
        ],
      })
    );

    const urls = await resolveDatabaseSources('/base/', 'https://example.org/', fetchImpl);

    expect(urls).toHaveLength(3);
    expect(urls[1]).toContain('api.github.com');
    expect(urls[2]).toContain('github.com/o/r/releases/download');
  });

  it('queries the pinned release tag', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ assets: [] }));
    await resolveDatabaseSources('/base/', 'https://example.org/', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(GITHUB_RELEASE_API);
  });

  it('ignores assets with a different name', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ assets: [{ name: 'other.zip', url: 'https://api.github.com/x' }] })
    );

    const urls = await resolveDatabaseSources('/base/', 'https://example.org/', fetchImpl);
    expect(urls).toHaveLength(1);
  });

  it('still returns the bundled copy when the release API is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('NetworkError'));
    const urls = await resolveDatabaseSources('/base/', 'https://example.org/', fetchImpl);

    expect(urls).toEqual([`https://example.org/base/datas/${DB_ASSET_NAME}`]);
  });

  it('still returns the bundled copy when the release API rate-limits', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    const urls = await resolveDatabaseSources('/base/', 'https://example.org/', fetchImpl);

    expect(urls).toHaveLength(1);
  });

  it('lists no dead third-party proxy mirrors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        assets: [{ name: DB_ASSET_NAME, browser_download_url: 'https://github.com/o/r/d.gz' }],
      })
    );

    const urls = await resolveDatabaseSources('/base/', 'https://example.org/', fetchImpl);

    for (const dead of ['ghp.ci', 'moeyy', 'ghproxy', 'corsproxy']) {
      expect(urls.join(' ')).not.toContain(dead);
    }
  });
});

describe('describeInstallProgress', () => {
  it('passes the percentage through for the download step', () => {
    expect(describeInstallProgress({ step: 'download', current: 0, total: 0, percent: 42 }, t)).toBe(
      'localDb.step_download:{"percent":42}'
    );
  });

  it.each(['decompress', 'validate', 'install'])('has a dedicated message for %s', (step) => {
    expect(describeInstallProgress({ step, current: 0, total: 0, percent: 0 }, t)).toBe(
      `localDb.step_${step}`
    );
  });

  it('falls back to the start message for an unknown step', () => {
    expect(describeInstallProgress({ step: 'weird', current: 0, total: 0, percent: 0 }, t)).toBe(
      'localDb.progress_start'
    );
  });
});

describe('describeInstallError', () => {
  it('surfaces which sources failed to download', () => {
    const message = describeInstallError(new Error('error_download|github.com/x: HTTP 404'), t);
    expect(message).toContain('localDb.error_download');
    expect(message).toContain('github.com/x: HTTP 404');
  });

  it('maps validation failures with their detail', () => {
    expect(describeInstallError(new Error('error_validation|not a database'), t)).toBe(
      'localDb.error_validation:{"msg":"not a database"}'
    );
  });

  it.each(['error_no_url', 'error_empty', 'error_not_loaded'])('maps %s', (code) => {
    expect(describeInstallError(new Error(code), t)).toBe(`localDb.${code}`);
  });

  it('maps a deserialize failure with its sqlite return code', () => {
    expect(describeInstallError(new Error('error_deserialize|7'), t)).toBe(
      'localDb.error_deserialize:{"code":"7"}'
    );
  });

  it('passes an unrecognised message through unchanged', () => {
    expect(describeInstallError(new Error('boom'), t)).toBe('boom');
  });

  it('falls back to the generic error for a non-Error value', () => {
    expect(describeInstallError(undefined, t)).toBe('common.error');
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KiB'],
    [1536, '1.5 KiB'],
    [1024 ** 2, '1 MiB'],
    [1024 ** 3, '1 GiB'],
  ])('formats %i as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('does not produce a negative or NaN size', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  it('caps the unit at terabytes', () => {
    expect(formatBytes(1024 ** 6)).toContain('TiB');
  });

  it('honours the requested precision', () => {
    expect(formatBytes(1536, 0)).toBe('2 KiB');
  });
});
