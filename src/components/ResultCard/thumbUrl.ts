/**
 * Thumbnail URLs for Inducks images.
 *
 * Values arrive as "sitecode|url" (or a bare url). Relative paths live on
 * outducks.org, and recent webusers uploads sit under a doubled
 * `webusers/webusers/` prefix. Everything goes through hr.php behind the
 * image proxy so the Inducks cookie applies.
 */

export interface ThumbUrls {
  /** Reduced-size image (hr.php normalsize=1), for cards and lists. */
  preview: string;
  /** Full-size scan, for the zoom button. */
  full: string;
}

function resolveOutducksUrl(value: string): string {
  // Handle both "sitecode|url" and plain "url"
  const parts = value.split("|");
  const url = parts.length > 1 ? parts[1] : parts[0];
  if (url.startsWith("http")) return url;
  // If sitecode is webusers and path doesn't start with webusers, prepend it
  // Note: Outducks often uses 'webusers/webusers/' for recent uploads
  if (parts[0] === "webusers" && !url.startsWith("webusers/")) {
    return `https://outducks.org/webusers/webusers/${url}`;
  }
  return `https://outducks.org/${url.startsWith("/") ? url.substring(1) : url}`;
}

/** Proxied preview URL, or null when there is no image at all. */
export function thumbUrl(value?: string | null): string | null {
  if (!value) return null;
  const baseUrl = resolveOutducksUrl(value);
  return `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=${baseUrl}`)}`;
}

/** Preview and full-size pair for cards that offer a zoom button. */
export function thumbUrls(value?: string | null): ThumbUrls | null {
  if (!value) return null;
  const baseUrl = resolveOutducksUrl(value);
  return {
    preview: `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=${baseUrl}`)}`,
    full: `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?image=${baseUrl}`)}`,
  };
}
