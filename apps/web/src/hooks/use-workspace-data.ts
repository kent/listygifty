"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { AUTH_ROUTES } from "@/services";
import { useRequestGuard } from "./use-request-guard";

interface UseWorkspaceDataOptions<T> {
  /** Function to fetch data - called when workspace changes */
  fetcher: () => Promise<T>;
  /** Initial data value */
  initialData?: T;
  /** Whether to redirect to sign in if not authenticated (default: true) */
  requireAuth?: boolean;
  /** Route/resource identifier whose change requires a fresh request. */
  resourceKey?: string | number;
}

interface UseWorkspaceDataResult<T> {
  data: T;
  setData: React.Dispatch<React.SetStateAction<T>>;
  isLoading: boolean;
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
}: UseWorkspaceDataOptions<T>): UseWorkspaceDataResult<T> {
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const { currentWorkspace, isLoading: workspaceLoading, error: workspaceError } = useWorkspace();
  const router = useRouter();

  const scope = JSON.stringify([isAuthenticated ? user?.clerk_user_id : null, currentWorkspace?.id, resourceKey]);
  const { start, invalidate, isActive } = useRequestGuard(scope);
  const canLoad = !authLoading && !workspaceLoading && isAuthenticated && !!currentWorkspace;
  const [snapshot, setSnapshot] = useState<{ scope: string; data: T; loading: boolean; error: string | null } | null>(null);
  const activeSnapshot = snapshot?.scope === scope ? snapshot : null;
  const data = activeSnapshot ? activeSnapshot.data : initialData as T;

  // Track the fetcher to avoid stale closures
  const fetcherRef = useRef(fetcher);
  const initialDataRef = useRef(initialData as T);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
    initialDataRef.current = initialData as T;
  }, [fetcher, initialData]);

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (requireAuth && !authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [authLoading, isAuthenticated, requireAuth, router]);

  const loadData = useCallback(async () => {
    if (!canLoad || !isActive()) return;
    const isCurrent = start();
    setSnapshot((current) => ({ scope, data: current?.scope === scope ? current.data : initialDataRef.current, loading: true, error: null }));
    try {
      const result = await fetcherRef.current();
      if (isCurrent()) setSnapshot({ scope, data: result, loading: false, error: null });
    } catch (err) {
      if (isCurrent()) {
        setSnapshot((current) => ({
          scope,
          data: current?.scope === scope ? current.data : initialDataRef.current,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load data. Please try again.",
        }));
      }
    }
  }, [canLoad, isActive, start, scope]);

  const setData = useCallback<React.Dispatch<React.SetStateAction<T>>>((action) => {
    if (!isActive()) return;
    invalidate();
    setSnapshot((current) => {
      const previous = current?.scope === scope ? current.data : initialDataRef.current;
      const next = typeof action === "function" ? (action as (previous: T) => T)(previous) : action;
      return { scope, data: next, loading: false, error: null };
    });
  }, [isActive, invalidate, scope]);

  // Reload data when workspace changes
  useEffect(() => {
    if (canLoad) void loadData();
    else if (!authLoading && !isAuthenticated) setSnapshot(null);
    return invalidate;
  }, [authLoading, isAuthenticated, canLoad, loadData, invalidate]);

  const isLoading = authLoading || workspaceLoading || (canLoad && (!activeSnapshot || activeSnapshot.loading));

  return {
    data,
    setData,
    isLoading,
    error: workspaceError || activeSnapshot?.error || null,
    refetch: loadData,
    user,
    signOut,
  };
}
