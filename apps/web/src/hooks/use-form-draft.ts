import { useCallback, useEffect, useRef } from "react";

const PREFIX = "form-draft:";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Removes every saved form, so nothing typed stays behind after sign-out. */
export function clearFormDrafts() {
  const store = storage();
  if (!store) return;
  Object.keys(store)
    .filter((key) => key.startsWith(PREFIX))
    .forEach((key) => store.removeItem(key));
}

/**
 * Keeps a half-filled form through a refresh or a trip back, for this tab only.
 * Returns a function to call once the form is submitted.
 */
export function useFormDraft<T>(key: string, value: T, restore: (draft: T) => void) {
  const storageKey = `${PREFIX}${key}`;
  const restoreRef = useRef(restore);
  const skipFirstSave = useRef(true);
  const serialized = JSON.stringify(value);

  useEffect(() => {
    restoreRef.current = restore;
  });

  useEffect(() => {
    try {
      const saved = storage()?.getItem(storageKey);
      if (saved) restoreRef.current(JSON.parse(saved) as T);
    } catch {
      // A damaged draft just means starting from a clean form.
    }
  }, [storageKey]);

  useEffect(() => {
    // The first render holds the blank form, which must not replace the draft.
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    try {
      storage()?.setItem(storageKey, serialized);
    } catch {
      // A full or blocked store only costs the convenience.
    }
  }, [storageKey, serialized]);

  return useCallback(() => storage()?.removeItem(storageKey), [storageKey]);
}
