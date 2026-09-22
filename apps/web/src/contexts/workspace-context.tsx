"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  useMemo,
  Fragment,
  ReactNode,
} from "react";
import type { AppBootstrapData, Workspace } from "@niftygifty/types";
import { useAuth } from "./auth-context";
import { bootstrapService } from "@/services";
import { apiClient } from "@/lib/api-client";
import { useRequestGuard } from "@/hooks/use-request-guard";

const WORKSPACE_STORAGE_KEY = "niftygifty_current_workspace_id";

function savedWorkspaceId(): number | null {
  try {
    const value = Number(localStorage.getItem(WORKSPACE_STORAGE_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function rememberWorkspace(id: number | null): void {
  try {
    if (id) localStorage.setItem(WORKSPACE_STORAGE_KEY, String(id));
    else localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Workspace selection remains usable when browser storage is unavailable.
  }
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  bootstrapData: AppBootstrapData | null;
  personalWorkspace: Workspace | null;
  businessWorkspaces: Workspace[];
  switchWorkspace: (workspaceId: number) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading, hydrateBillingStatus } = useAuth();
  const userId = isAuthenticated ? user?.clerk_user_id ?? null : null;
  const { start, invalidate, isActive } = useRequestGuard(userId);
  const [snapshot, setSnapshot] = useState<{
    userId: string;
    workspaces: Workspace[];
    workspaceId: number | null;
    data: AppBootstrapData | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeSnapshot = snapshot?.userId === userId ? snapshot : null;
  const workspaces = useMemo(() => activeSnapshot?.workspaces ?? [], [activeSnapshot]);
  const currentWorkspaceId = activeSnapshot?.workspaceId ?? null;
  const pageScope = `${userId ?? "signed-out"}:${currentWorkspaceId ?? "none"}`;
  const { isActive: isWorkspaceActive } = useRequestGuard(pageScope);
  const bootstrapData = activeSnapshot?.data ?? null;

  const fetchBootstrap = useCallback(async (preferredWorkspaceId?: number | null) => {
    if (!userId || !isActive()) return;
    const isCurrent = start();
    setIsLoading(true);
    setError(null);

    try {
      const data = await bootstrapService.get(preferredWorkspaceId);
      if (!isCurrent()) return;
      const resolvedWorkspaceId =
        data.current_workspace_id ??
        data.workspaces.find((workspace) => workspace.workspace_type === "personal")?.id ??
        data.workspaces[0]?.id ??
        null;

      setSnapshot({ userId, workspaces: data.workspaces, workspaceId: resolvedWorkspaceId, data: data.data });
      hydrateBillingStatus(data.billing_status);
      apiClient.setWorkspaceId(resolvedWorkspaceId);
      rememberWorkspace(resolvedWorkspaceId);
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Failed to load workspace bootstrap:", error);
      setError("Could not load your workspace. Please try again.");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [hydrateBillingStatus, userId, start, isActive]);

  const refreshWorkspaces = useCallback(async () => {
    if (!isWorkspaceActive()) return;
    await fetchBootstrap(currentWorkspaceId ?? savedWorkspaceId());
  }, [currentWorkspaceId, fetchBootstrap, isWorkspaceActive]);

  useEffect(() => {
    if (!authLoading) {
      setSnapshot(null);
      setError(null);
      apiClient.setWorkspaceId(null);
      if (userId) void fetchBootstrap(savedWorkspaceId());
      else setIsLoading(false);
    }
    return invalidate;
  }, [authLoading, fetchBootstrap, userId, invalidate]);

  const switchWorkspace = useCallback((workspaceId: number) => {
    if (!userId || !isActive()) return;
    setSnapshot((current) => current?.userId === userId ? { ...current, workspaceId, data: null } : null);
    rememberWorkspace(workspaceId);
    apiClient.setWorkspaceId(workspaceId);
    void fetchBootstrap(workspaceId);
  }, [fetchBootstrap, userId, isActive]);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId) || null,
    [workspaces, currentWorkspaceId]
  );

  const personalWorkspace = useMemo(
    () => workspaces.find((w) => w.workspace_type === "personal") || null,
    [workspaces]
  );

  const businessWorkspaces = useMemo(
    () => workspaces.filter((w) => w.workspace_type === "business"),
    [workspaces]
  );

  const contextValue = useMemo<WorkspaceContextType>(
    () => ({
      workspaces,
      currentWorkspace,
      isLoading: isLoading || authLoading || (!!userId && !activeSnapshot && !error),
      error,
      bootstrapData,
      personalWorkspace,
      businessWorkspaces,
      switchWorkspace,
      refreshWorkspaces,
    }),
    [
      workspaces,
      currentWorkspace,
      isLoading,
      authLoading,
      userId,
      activeSnapshot,
      error,
      bootstrapData,
      personalWorkspace,
      businessWorkspaces,
      switchWorkspace,
      refreshWorkspaces,
    ]
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {error && (
        <div role="alert" className="flex items-center justify-center gap-3 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
          <button type="button" onClick={() => void refreshWorkspaces()} className="font-semibold underline">Retry</button>
        </div>
      )}
      {/* Forms and custom page loaders belong to one account and workspace. */}
      <Fragment key={pageScope}>{children}</Fragment>
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

/**
 * Noop workspace provider for build-time rendering.
 */
export function NoopWorkspaceProvider({ children }: { children: ReactNode }) {
  const noopValue: WorkspaceContextType = {
    workspaces: [],
    currentWorkspace: null,
    isLoading: true,
    error: null,
    bootstrapData: null,
    personalWorkspace: null,
    businessWorkspaces: [],
    switchWorkspace: () => {},
    refreshWorkspaces: async () => {},
  };

  return (
    <WorkspaceContext.Provider value={noopValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}
