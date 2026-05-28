import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const scopeIdRef = useRef(0);
  const hasResolvedRef = useRef(false);
  const lastKeyRef = useRef(key);
  const loadRef = useRef(load);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  const isCurrentRequest = useCallback(
    (requestId: number, scopeId: number) =>
      requestIdRef.current === requestId && scopeIdRef.current === scopeId,
    []
  );

  const runLoad = useCallback(
    async (mode: LoadMode = "initial") => {
      if (!enabled) {
        setLoading(false);
        setRefreshing(false);
        return undefined;
      }

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
        setError(null);
        const nextData = await loadRef.current();
        if (isCurrentRequest(requestId, scopeId)) {
          setData(nextData);
          hasResolvedRef.current = true;
        }
        return nextData;
      } catch (loadError) {
        console.error(errorMessage, loadError);
        if (isCurrentRequest(requestId, scopeId)) {
          setError(errorMessage);
        }
        return undefined;
      } finally {
        if (isCurrentRequest(requestId, scopeId)) {
          if (mode === "refresh") {
            setRefreshing(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [enabled, errorMessage, isCurrentRequest]
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
        setData(initialValueRef.current);
        setError(null);
      }

      scopeIdRef.current += 1;
      void runLoad("initial");
      return () => {
        scopeIdRef.current += 1;
      };
    }, [enabled, key, runLoad])
  );

  const refresh = useCallback(() => {
    void runLoad("refresh");
  }, [runLoad]);

  const reload = useCallback(async () => runLoad("initial"), [runLoad]);

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
