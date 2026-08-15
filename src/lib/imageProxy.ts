/**
 * Inducks images are only reachable through the local development proxy
 * (`scripts/image-proxy.mjs`), which relays the developer's own Anubis
 * clearance from their own machine.
 *
 * The deployed site has no such backend, and that is deliberate: nothing on
 * GitHub Pages can hold a session, and standing in for every visitor's browser
 * is not something this project does. So in production these helpers return
 * null and the components fall back to their placeholders, instead of firing
 * requests at a path that answers 404.
 */

/** Set VITE_IMAGE_PROXY to point a production preview at a running proxy. */
const CONFIGURED = import.meta.env.VITE_IMAGE_PROXY as string | undefined;

/** True when image requests have somewhere to go. */
export const imagesAvailable = (): boolean => Boolean(CONFIGURED) || import.meta.env.DEV;

/**
 * Wraps a remote Inducks URL for the proxy, or returns null when no proxy is
 * reachable — callers must treat null as "render the fallback".
 */
export function proxiedImage(remoteUrl: string): string | null {
  if (!imagesAvailable()) return null;
  const base = (CONFIGURED || "").replace(/\/$/, "");
  return `${base}/api/proxy-image?url=${encodeURIComponent(remoteUrl)}`;
}

/**
 * `hr.php` renders a scan at a chosen size; `normalsize=1` is the preview.
 *
 * Parameter shape copied from what inducks.org itself emits:
 *
 *   hr.php?image=https%3A%2F%2Foutducks.org%2F…%2Ffr_tp_0075a_001.jpg&normalsize=1
 *
 * The image URL is percent-encoded. Interpolating it raw happened to work
 * because outducks paths carry no `&` or `#`, but a single one would have
 * truncated the parameter.
 */
export function hrImage(imageUrl: string, full = false): string | null {
  const params = `image=${encodeURIComponent(imageUrl)}${full ? "" : "&normalsize=1"}`;
  return proxiedImage(`https://inducks.org/hr.php?${params}`);
}

export const characterThumb = (code: string): string | null =>
  proxiedImage(`https://inducks.org/characterthumb.php?c=${code}`);

/**
 * Hands the local proxy a fresh Anubis clearance cookie.
 *
 * The cookie is short-lived, and the proxy runs server-side where it cannot see
 * the browser's own cookies — so it has to be handed over explicitly. This is
 * what the Settings field was always meant to do; until now it only wrote to
 * localStorage, where nothing read it.
 *
 * Resolves to false when no proxy is listening, which is the normal state on the
 * deployed site.
 */
export async function sendCookieToProxy(cookie: string): Promise<boolean> {
  if (!imagesAvailable()) return false;
  const base = (CONFIGURED || "").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/cookie`, { method: "POST", body: cookie });
    return res.ok;
  } catch {
    // Proxy not running — the caller reports this as "saved locally only".
    return false;
  }
}

export const creatorPhoto = (code: string): string | null =>
  proxiedImage(`https://inducks.org/creators/photos/${code.replace(/ /g, "_")}.jpg`);
