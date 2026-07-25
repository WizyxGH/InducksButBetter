import { useState, useEffect } from "react";
import { hasLocalDb } from "@/lib/localDb";

/**
 * Returns `true` when Turso is overloaded (quota exceeded) and no local DB
 * is available, meaning all search buttons should be disabled.
 *
 * Reactivity is driven by:
 * - `db-quota-error` – fired by handleDbError() when Turso returns a quota error
 * - `db-local-loaded` – fired when a local DB is successfully loaded
 *
 * The initial value is derived from sessionStorage so the disabled state
 * persists across re-renders within the same browser session.
 */
function isDbUnavailable(): boolean {
  return !hasLocalDb() && sessionStorage.getItem("db_quota_status") === "failed";
}

export function useSearchDisabled(): boolean {
  const [disabled, setDisabled] = useState(isDbUnavailable);

  useEffect(() => {
    const onQuotaError = () => {
      if (!hasLocalDb()) setDisabled(true);
    };

    const onLocalLoaded = () => setDisabled(false);

    window.addEventListener("db-quota-error", onQuotaError);
    window.addEventListener("db-local-loaded", onLocalLoaded);

    return () => {
      window.removeEventListener("db-quota-error", onQuotaError);
      window.removeEventListener("db-local-loaded", onLocalLoaded);
    };
  }, []);

  return disabled;
}
