import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useLayoutEffect, useRef, useState, type SetStateAction } from "react";

type LoadMode = "initial" | "refresh";

interface UseFocusResourceOptions<T> {
  enabled?: boolean;
  errorMessage: string;
  initialValue: T;
  key?: string | number | null;
  load: () => Promise<T>;
}

export function useFocusResource<T>({
  enabled = true,
  errorMessage,
  initialValue,
  key,
  load,
}: UseFocusResourceOptions<T>) {
  const [data, updateData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, updateError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const scopeIdRef = useRef(0);
  const hasResolvedRef = useRef(false);
  const lastKeyRef = useRef(key);
  const loadRef = useRef(load);
  const initialValueRef = useRef(initialValue);
  const focusedRef = useRef(false);

  useLayoutEffect(() => {
    loadRef.current = load;
  }, [load]);

  useLayoutEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  const isCurrentRequest = useCallback(
    (requestId: number, scopeId: number) =>
      requestIdRef.current === requestId && scopeIdRef.current === scopeId,
    []
  );

  const runLoad = useCallback(
    async (mode: LoadMode = "initial") => {
      if (!enabled || !focusedRef.current || lastKeyRef.current !== key) return undefined;

      const requestId = requestIdRef.current + 1;
      const scopeId = scopeIdRef.current;
      requestIdRef.current = requestId;

      const shouldBlockScreen = mode === "initial" && !hasResolvedRef.current;

      if (mode === "refresh") {
        setRefreshing(true);
      } else if (shouldBlockScreen) {
        setLoading(true);
      }

      try {
        updateError(null);
        const nextData = await loadRef.current();
        if (isCurrentRequest(requestId, scopeId)) {
          updateData(nextData);
          hasResolvedRef.current = true;
          return nextData;
        }
        return undefined;
      } catch (loadError) {
        if (isCurrentRequest(requestId, scopeId)) {
          console.error(errorMessage, loadError);
          updateError(errorMessage);
        }
        return undefined;
      } finally {
        if (isCurrentRequest(requestId, scopeId)) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    },
    [enabled, errorMessage, isCurrentRequest, key]
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setLoading(false);
        setRefreshing(false);
        return undefined;
      }

      if (lastKeyRef.current !== key) {
        lastKeyRef.current = key;
        hasResolvedRef.current = false;
        updateData(initialValueRef.current);
        updateError(null);
      }

      scopeIdRef.current += 1;
      focusedRef.current = true;
      void runLoad("initial");
      return () => {
        scopeIdRef.current += 1;
        focusedRef.current = false;
      };
    }, [enabled, key, runLoad])
  );

  const refresh = useCallback(() => {
    void runLoad("refresh");
  }, [runLoad]);

  const reload = useCallback(async () => runLoad("initial"), [runLoad]);

  const setData = useCallback((value: SetStateAction<T>) => {
    if (!focusedRef.current || lastKeyRef.current !== key) return;
    requestIdRef.current += 1;
    hasResolvedRef.current = true;
    updateData(value);
    setLoading(false);
    setRefreshing(false);
  }, [key]);

  const setError = useCallback((value: SetStateAction<string | null>) => {
    if (focusedRef.current && lastKeyRef.current === key) updateError(value);
  }, [key]);

  return {
    data,
    error,
    loading,
    refresh,
    refreshing,
    reload,
    setData,
    setError,
  };
}
