import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getStoredCollection,
  saveStoredCollection,
  toggleStoredIssue,
  isIssueInCollection,
  COLLECTION_CHANGED_EVENT,
  COLLECTION_STORAGE_KEY,
} from "@/lib/collection";

/**
 * React hook providing reactive state and helper methods for user's Inducks collection.
 */
export function useCollection() {
  const [issues, setIssues] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return getStoredCollection();
  });

  useEffect(() => {
    const handleUpdate = () => {
      setIssues(getStoredCollection());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === COLLECTION_STORAGE_KEY) {
        handleUpdate();
      }
    };

    window.addEventListener(COLLECTION_CHANGED_EVENT, handleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(COLLECTION_CHANGED_EVENT, handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const issueSet = useMemo(() => new Set(issues), [issues]);

  const hasIssue = useCallback(
    (code: string) => isIssueInCollection(code, issueSet),
    [issueSet]
  );

  const toggleIssue = useCallback((code: string) => {
    return toggleStoredIssue(code);
  }, []);

  const saveCollection = useCallback((newIssues: string[]) => {
    saveStoredCollection(newIssues);
  }, []);

  return {
    issues,
    issueSet,
    count: issues.length,
    hasIssue,
    toggleIssue,
    saveCollection,
  };
}

