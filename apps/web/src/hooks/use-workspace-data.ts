"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { humanizeError } from "@/lib/error-message";
import { signInUrlForCurrentPage } from "@/lib/sign-in-redirect";
import { useRequestGuard } from "./use-request-guard";

/**
 * The last data each page saw, per user, workspace and resource, so going back
 * to a page renders it straight away instead of flashing an empty state.
 * Each entry notes the placeholder it was saved alongside: if the placeholder
 * has changed since (bootstrap was refreshed), the placeholder is newer and wins.
 * Lives only in memory and is cleared on sign-out.
 */
const lastSeen = new Map<string, { data: unknown; placeholder: unknown }>();

interface UseWorkspaceDataOptions<T> {
  /** Function to fetch data - called when workspace changes */
  fetcher: () => Promise<T>;
  /** Initial data value */
  initialData?: T;
  /** Whether to redirect to sign in if not authenticated (default: true) */
  requireAuth?: boolean;
  /** Route/resource identifier whose change requires a fresh request. */
  resourceKey?: string | number;
  /** Real data to show while the first request is in flight, e.g. from the bootstrap payload. */
  placeholderData?: T;
  /** Remember the last data for this page so a revisit shows it while it refreshes. */
  cacheKey?: string;
}

interface UseWorkspaceDataResult<T> {
  data: T;
  setData: React.Dispatch<React.SetStateAction<T>>;
  isLoading: boolean;
  /** True once `data` is real (fetched, updated locally, remembered or a placeholder), not just `initialData`. */
  hasData: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  user: ReturnType<typeof useAuth>["user"];
  signOut: ReturnType<typeof useAuth>["signOut"];
}

/**
 * Hook for loading workspace-scoped data that automatically refetches when workspace changes.
 * Handles authentication, loading states, and error handling.
 */
export function useWorkspaceData<T>({
  fetcher,
  initialData,
  requireAuth = true,
  resourceKey,
  placeholderData,
  cacheKey,
}: UseWorkspaceDataOptions<T>): UseWorkspaceDataResult<T> {
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const { currentWorkspace, isLoading: workspaceLoading, error: workspaceError } = useWorkspace();
  const router = useRouter();

  const scope = JSON.stringify([isAuthenticated ? user?.clerk_user_id : null, currentWorkspace?.id, resourceKey]);
  const { start, invalidate, isActive } = useRequestGuard(scope);
  const canLoad = !authLoading && !workspaceLoading && isAuthenticated && !!currentWorkspace;
  const [snapshot, setSnapshot] = useState<{ scope: string; data: T; hasData: boolean; loading: boolean; error: string | null } | null>(null);
  const activeSnapshot = snapshot?.scope === scope ? snapshot : null;
  const cacheId = cacheKey ? `${cacheKey}:${scope}` : null;
  const entry = cacheId !== null ? lastSeen.get(cacheId) : undefined;
  const remembered = entry !== undefined && entry.placeholder === placeholderData;
  const fallback = {
    data: (remembered ? entry.data : placeholderData !== undefined ? placeholderData : initialData) as T,
    hasData: remembered || placeholderData !== undefined,
  };
  const data = activeSnapshot ? activeSnapshot.data : fallback.data;

  // Track the fetcher and fallback to avoid stale closures
  const fetcherRef = useRef(fetcher);
  const fallbackRef = useRef(fallback);
  const placeholderRef = useRef(placeholderData);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
    fallbackRef.current = fallback;
    placeholderRef.current = placeholderData;
  });

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (requireAuth && !authLoading && !isAuthenticated) {
      router.push(signInUrlForCurrentPage());
    }
  }, [authLoading, isAuthenticated, requireAuth, router]);

  const loadData = useCallback(async () => {
    if (!canLoad || !isActive()) return;
    const isCurrent = start();
    setSnapshot((current) => ({ ...(current?.scope === scope ? current : fallbackRef.current), scope, loading: true, error: null }));
    try {
      const result = await fetcherRef.current();
      if (isCurrent()) {
        if (cacheId) lastSeen.set(cacheId, { data: result, placeholder: placeholderRef.current });
        setSnapshot({ scope, data: result, hasData: true, loading: false, error: null });
      }
    } catch (err) {
      if (isCurrent()) {
        setSnapshot((current) => ({
          ...(current?.scope === scope ? current : fallbackRef.current),
          scope,
          loading: false,
          error: humanizeError(err, "Failed to load data. Please try again."),
        }));
      }
    }
  }, [canLoad, isActive, start, scope, cacheId]);

  const setData = useCallback<React.Dispatch<React.SetStateAction<T>>>((action) => {
    if (!isActive()) return;
    invalidate();
    setSnapshot((current) => {
      const previous = current?.scope === scope ? current.data : fallbackRef.current.data;
      const next = typeof action === "function" ? (action as (previous: T) => T)(previous) : action;
      if (cacheId) lastSeen.set(cacheId, { data: next, placeholder: placeholderRef.current });
      return { scope, data: next, hasData: true, loading: false, error: null };
    });
  }, [isActive, invalidate, scope, cacheId]);

  // Reload data when workspace changes
  useEffect(() => {
    if (canLoad) void loadData();
    else if (!authLoading && !isAuthenticated) {
      setSnapshot(null);
      lastSeen.clear();
    }
    return invalidate;
  }, [authLoading, isAuthenticated, canLoad, loadData, invalidate]);

  const isLoading = authLoading || workspaceLoading || (canLoad && (!activeSnapshot || activeSnapshot.loading));

  return {
    data,
    setData,
    isLoading,
    hasData: activeSnapshot ? activeSnapshot.hasData : fallback.hasData,
    error: workspaceError || activeSnapshot?.error || null,
    refetch: loadData,
    user,
    signOut,
  };
}
