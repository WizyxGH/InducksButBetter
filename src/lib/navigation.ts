const BASE_URL = import.meta.env.BASE_URL || "/";

export function getBasePath(): string {
  return BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
}

/**
 * Navigate to a new path in the application using the History API.
 * 
 * @param path The path to navigate to (e.g. "/stories/123"). Can include query or hash.
 * @param replace If true, uses replaceState instead of pushState
 */
export function navigate(path: string, replace: boolean = false) {
  // If the path is a hash (e.g. "#/stories/123"), clean it up first
  let cleanPath = path;
  if (cleanPath.startsWith('#/')) {
    cleanPath = cleanPath.substring(1);
  }

  // Ensure path starts with /
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const fullPath = `${getBasePath()}${normalizedPath}`;
  
  const currentUrl = window.location.pathname + window.location.search + window.location.hash;
  
  if (currentUrl === fullPath) {
    return; // Do nothing if we're already exactly on this path
  }
  
  if (replace) {
    window.history.replaceState(null, "", fullPath);
  } else {
    window.history.pushState(null, "", fullPath);
  }
  
  // Dispatch a popstate event to trigger routers/App.tsx listening to it
  const popStateEvent = new PopStateEvent('popstate', { state: null });
  window.dispatchEvent(popStateEvent);
}
