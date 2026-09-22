"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

/** Keeps only the latest request in a committed account/resource scope active. */
export function useRequestGuard(scope: string | null) {
  const current = useRef({ scope, generation: 0, mounted: false });

  useLayoutEffect(() => {
    const state = current.current;
    state.scope = scope;
    state.mounted = true;
    state.generation += 1;
    return () => {
      state.mounted = false;
      state.generation += 1;
    };
  }, [scope]);

  const isActive = useCallback(() => current.current.mounted && current.current.scope === scope, [scope]);
  const invalidate = useCallback(() => {
    if (isActive()) current.current.generation += 1;
  }, [isActive]);
  const start = useCallback(() => {
    if (!isActive()) return () => false;
    const generation = ++current.current.generation;
    return () => isActive() && current.current.generation === generation;
  }, [isActive]);

  return useMemo(() => ({ start, invalidate, isActive }), [start, invalidate, isActive]);
}
