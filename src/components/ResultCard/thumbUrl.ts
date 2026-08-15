/**
 * Thumbnail URLs for Inducks images.
 *
 * Values arrive as "sitecode|url" (or a bare url). Relative paths live on
 * outducks.org, and recent webusers uploads sit under a doubled
 * `webusers/webusers/` prefix. Everything goes through hr.php behind the local
 * image proxy, so these helpers return null when no proxy is reachable.
 */
import { hrImage } from "@/lib/imageProxy";

export interface ThumbUrls {
  /** Reduced-size image (hr.php normalsize=1), for cards and lists. */
  preview: string;
  /** Full-size scan, for the zoom button. */
  full: string;
}

const OUTDUCKS = "https://outducks.org";

/**
 * Base URL for a site code, mirroring `inducks_site.urlbase`.
 *
 * All 41 rows flagged `images = 'Y'` follow `https://outducks.org/<sitecode>/`
 * with exactly one exception: `webusers` doubles its segment. Deriving the base
 * from the site code is what the previous version was missing — it rooted every
 * non-webusers path straight at the domain, dropping the segment entirely, so
 * `thumbnails|webusers/a.jpg` resolved to /webusers/a.jpg instead of
 * /thumbnails/webusers/a.jpg. Only `webusers` ever produced a working URL.
 */
function siteUrlBase(sitecode: string): string {
  return sitecode === "webusers" ? `${OUTDUCKS}/webusers/webusers/` : `${OUTDUCKS}/${sitecode}/`;
}

function resolveOutducksUrl(value: string): string {
  // Handle both "sitecode|url" and plain "url"
  const separator = value.indexOf("|");
  if (separator === -1) {
    // No site code to resolve against — root it at the domain as before.
    return value.startsWith("http") ? value : `${OUTDUCKS}/${value.replace(/^\//, "")}`;
  }

  const sitecode = value.slice(0, separator);
  const url = value.slice(separator + 1);
  if (url.startsWith("http")) return url;

  // Defensive: a path that already carries the doubled segment must not gain
  // a third one.
  if (sitecode === "webusers" && url.replace(/^\//, "").startsWith("webusers/")) {
    return `${OUTDUCKS}/webusers/${url.replace(/^\//, "").slice("webusers/".length)}`;
  }

  return siteUrlBase(sitecode) + url.replace(/^\//, "");
}

/** Proxied preview URL, or null when there is no image — or no proxy. */
export function thumbUrl(value?: string | null): string | null {
  if (!value) return null;
  return hrImage(resolveOutducksUrl(value));
}

/** Preview and full-size pair for cards that offer a zoom button. */
export function thumbUrls(value?: string | null): ThumbUrls | null {
  if (!value) return null;
  const baseUrl = resolveOutducksUrl(value);
  const preview = hrImage(baseUrl);
  const full = hrImage(baseUrl, true);
  if (!preview || !full) return null;
  return { preview, full };
}
