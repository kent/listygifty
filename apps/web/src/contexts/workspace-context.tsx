"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  useMemo,
  ReactNode,
} from "react";
import type { AppBootstrapData, Workspace } from "@niftygifty/types";
import { useAuth } from "./auth-context";
import { bootstrapService } from "@/services";
import { apiClient } from "@/lib/api-client";

const WORKSPACE_STORAGE_KEY = "niftygifty_current_workspace_id";

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
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
  const { isAuthenticated, isLoading: authLoading, hydrateBillingStatus } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<number | null>(
    null
  );
  const [bootstrapData, setBootstrapData] = useState<AppBootstrapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBootstrap = useCallback(async (preferredWorkspaceId?: number | null) => {
    if (!isAuthenticated) return;

    try {
      const data = await bootstrapService.get(preferredWorkspaceId);
      const resolvedWorkspaceId =
        data.current_workspace_id ??
        data.workspaces.find((workspace) => workspace.workspace_type === "personal")?.id ??
        data.workspaces[0]?.id ??
        null;

      setWorkspaces(data.workspaces);
      setBootstrapData(data.data);
      setCurrentWorkspaceId(resolvedWorkspaceId);
      hydrateBillingStatus(data.billing_status);
      apiClient.setWorkspaceId(resolvedWorkspaceId);

      if (resolvedWorkspaceId) {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, String(resolvedWorkspaceId));
      } else {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to load workspace bootstrap:", error);
    } finally {
      setIsLoading(false);
    }
  }, [hydrateBillingStatus, isAuthenticated]);

  const refreshWorkspaces = useCallback(async () => {
    const savedId = currentWorkspaceId ?? (() => {
      const savedValue = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      return savedValue ? parseInt(savedValue, 10) : null;
    })();

    await fetchBootstrap(savedId);
  }, [currentWorkspaceId, fetchBootstrap]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setIsLoading(true);
      const savedValue = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      const savedWorkspaceId = savedValue ? parseInt(savedValue, 10) : null;
      void fetchBootstrap(savedWorkspaceId);
    } else if (!authLoading && !isAuthenticated) {
      setWorkspaces([]);
      setBootstrapData(null);
      setCurrentWorkspaceId(null);
      apiClient.setWorkspaceId(null);
      setIsLoading(false);
    }
  }, [authLoading, fetchBootstrap, isAuthenticated]);

  const switchWorkspace = useCallback((workspaceId: number) => {
    setBootstrapData(null);
    setIsLoading(true);
    setCurrentWorkspaceId(workspaceId);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, String(workspaceId));
    apiClient.setWorkspaceId(workspaceId);
    void fetchBootstrap(workspaceId);
  }, [fetchBootstrap]);

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
      isLoading: isLoading || authLoading,
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
      bootstrapData,
      personalWorkspace,
      businessWorkspaces,
      switchWorkspace,
      refreshWorkspaces,
    ]
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
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
