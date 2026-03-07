import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";

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

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError(null);
        const nextData = await load();
        if (isCurrentRequest(requestId, scopeId)) {
          setData(nextData);
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
    [enabled, errorMessage, isCurrentRequest, load]
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setLoading(false);
        setRefreshing(false);
        return undefined;
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
