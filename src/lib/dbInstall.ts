/**
 * Shared logic for installing the local Inducks database.
 *
 * Both the header dialog (`LocalDbUploader`) and the settings card
 * (`LocalDatabaseCard`) drive the same install flow, so source resolution,
 * progress wording and error mapping live here rather than being duplicated.
 */

export interface InstallProgress {
  step: string;
  current: number;
  total: number;
  percent: number;
}

/** Minimal shape of a GitHub release asset, as returned by the REST API. */
interface GitHubAsset {
  name: string;
  browser_download_url?: string;
  /** API URL — the only one that reliably passes CORS from a browser. */
  url?: string;
  size?: number;
}

export const GITHUB_RELEASE_API =
  "https://api.github.com/repos/WizyxGH/InducksButBetter/releases/tags/datas";

export const DB_ASSET_NAME = "inducks.sqlite.gz";

/**
 * Builds the ordered list of URLs the worker should try when downloading the
 * pre-built database.
 *
 * Order matters — the worker stops at the first URL that fully installs:
 *
 *  1. the copy bundled with the deployment (same-origin, no CORS at all).
 *     This is the only source that reliably works in production, which is
 *     why the deploy workflow downloads the release asset into
 *     `public/datas/` before building;
 *  2. the GitHub *API* asset URL. `api.github.com` sends CORS headers on its
 *     302, but the final host (`release-assets.githubusercontent.com`)
 *     answers **without** `Access-Control-Allow-Origin`, so a cross-origin
 *     fetch usually still fails — kept because it works same-origin-ish
 *     setups and may be fixed server-side one day;
 *  3. `browser_download_url` as a last resort. `github.com` does not send
 *     CORS headers on its 302 either.
 */
export async function resolveDatabaseSources(
  baseUrl: string,
  origin: string,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const urls: string[] = [new URL(`${baseUrl}datas/${DB_ASSET_NAME}`, origin).href];

  try {
    const res = await fetchImpl(GITHUB_RELEASE_API);
    if (res.ok) {
      const release = await res.json();
      const assets: GitHubAsset[] = release?.assets ?? [];
      const asset = assets.find((a) => a.name === DB_ASSET_NAME);
      if (asset?.url) urls.push(asset.url);
      if (asset?.browser_download_url) urls.push(asset.browser_download_url);
    }
  } catch (err) {
    // The release API is optional: the bundled copy may be enough.
    console.warn("GitHub release lookup failed, falling back to bundled copy:", err);
  }

  return urls;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Maps a worker progress event to a user-facing message. */
export function describeInstallProgress(progress: InstallProgress, t: Translate): string {
  switch (progress.step) {
    case "download":
      // No percentage in the wording: the toast renders its own, to the
      // right of the message, and showing both read as "2%" twice.
      return t("localDb.step_download");
    case "decompress":
      return t("localDb.step_decompress");
    case "validate":
      return t("localDb.step_validate");
    case "install":
      return t("localDb.step_install");
    default:
      return t("localDb.progress_start");
  }
}

/**
 * Maps a worker error to a translated message.
 *
 * The worker reports failures as `code` or `code|detail` so that the wording
 * stays on the UI side and can be translated.
 */
export function describeInstallError(error: unknown, t: Translate): string {
  const raw = (error as Error)?.message ?? String(error ?? "");
  const [code, detail = ""] = raw.split("|");

  switch (code) {
    case "error_download":
      return t("localDb.error_download", { msg: detail });
    case "error_validation":
      return t("localDb.error_validation", { msg: detail });
    case "error_deserialize":
      return t("localDb.error_deserialize", { code: detail });
    case "error_no_url":
      return t("localDb.error_no_url");
    case "error_empty":
      return t("localDb.error_empty");
    case "error_not_loaded":
      return t("localDb.error_not_loaded");
    default:
      return raw || t("common.error");
  }
}

/**
 * Formats a byte count into a human-readable string.
 *
 * Binary units, because the divisor is 1024: labelling 1024-based values "GB"
 * understated the database as "1.06 GB" when it is 1.13 GB decimal — the same
 * 1 133 518 848 bytes, correctly named 1.06 GiB.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${parseFloat(value.toFixed(Math.max(0, decimals)))} ${units[i]}`;
}
