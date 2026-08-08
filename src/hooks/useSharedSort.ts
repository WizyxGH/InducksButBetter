import { useState, useEffect, useCallback } from "react";
import {
  PUBLICATION_SORT_STORAGE_KEY,
  loadStoredPublicationSort,
  storePublicationSort,
} from "@/lib/countrySort";

// Fired on window whenever a component changes the shared sort, so sibling
// screens mounted at the same time pick it up without a storage listener
// (the `storage` event only fires in *other* tabs).
const SORT_CHANGED_EVENT = "publication-sort-changed";

/**
 * Sort criterion shared by the country list and the country pages, persisted
 * under the same localStorage key both screens already used.
 */
export function useSharedSort(fallback: string): [string, (mode: string) => void] {
  const [sort, setSort] = useState(() => loadStoredPublicationSort(fallback));

  useEffect(() => {
    const onChanged = (e: Event) => {
      const mode = (e as CustomEvent<string>).detail;
      if (typeof mode === "string" && mode) setSort(mode);
    };
    window.addEventListener(SORT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SORT_CHANGED_EVENT, onChanged);
  }, []);

  const setSharedSort = useCallback((mode: string) => {
    setSort(mode);
    storePublicationSort(mode);
    window.dispatchEvent(new CustomEvent(SORT_CHANGED_EVENT, { detail: mode }));
  }, []);

  return [sort, setSharedSort];
}

export { PUBLICATION_SORT_STORAGE_KEY };
