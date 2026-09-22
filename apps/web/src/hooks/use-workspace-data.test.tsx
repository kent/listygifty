import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "@/test/deferred";
import { useWorkspaceData } from "./use-workspace-data";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false, user: { clerk_user_id: "user_a" } as { clerk_user_id: string } | null, signOut: vi.fn() },
  workspace: { currentWorkspace: { id: 1 } as { id: number } | null, isLoading: false },
  push: vi.fn(),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/services", () => ({ AUTH_ROUTES: { signIn: "/login" } }));

beforeEach(() => {
  mocks.auth.isAuthenticated = true;
  mocks.auth.isLoading = false;
  mocks.auth.user = { clerk_user_id: "user_a" };
  mocks.workspace.currentWorkspace = { id: 1 };
  mocks.workspace.isLoading = false;
});

describe("workspace data loading", () => {
  it("does not overwrite the selected workspace with an older response", async () => {
    const older = deferred<string[]>();
    const latest = deferred<string[]>();
    const fetcher = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const { result, rerender } = renderHook(() => useWorkspaceData({ fetcher, initialData: [] as string[] }));
    mocks.workspace.currentWorkspace = { id: 2 };
    rerender();
    await act(async () => latest.resolve(["Workspace 2"]));
    await act(async () => older.resolve(["Workspace 1"]));
    expect(result.current.data).toEqual(["Workspace 2"]);
  });

  it("clears prior workspace data immediately while loading a new workspace", async () => {
    const next = deferred<string[]>();
    const fetcher = vi.fn().mockResolvedValueOnce(["Private data"]).mockReturnValue(next.promise);
    const { result, rerender } = renderHook(() => useWorkspaceData({ fetcher, initialData: [] as string[] }));
    await waitFor(() => expect(result.current.data).toEqual(["Private data"]));
    mocks.workspace.currentWorkspace = { id: 2 };
    rerender();
    expect(result.current.data).toEqual([]);
    await act(async () => next.resolve(["New data"]));
  });

  it("does not expose a completed request after sign-out", async () => {
    const request = deferred<string[]>();
    const { result, rerender } = renderHook(() => useWorkspaceData({ fetcher: () => request.promise, initialData: [] as string[] }));
    mocks.auth.isAuthenticated = false;
    mocks.auth.user = null;
    mocks.workspace.currentWorkspace = null;
    rerender();
    await act(async () => request.resolve(["Private data"]));
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("waits for workspace bootstrap before fetching workspace data", async () => {
    mocks.workspace.isLoading = true;
    const fetcher = vi.fn().mockResolvedValue(["Current data"]);
    const { result, rerender } = renderHook(() => useWorkspaceData({ fetcher, initialData: [] as string[] }));
    expect(fetcher).not.toHaveBeenCalled();
    mocks.workspace.isLoading = false;
    rerender();
    await waitFor(() => expect(result.current.data).toEqual(["Current data"]));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("ignores a failure from an obsolete workspace request", async () => {
    const old = deferred<string[]>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(["Current data"]);
    const { result, rerender } = renderHook(() => useWorkspaceData({ fetcher, initialData: [] as string[] }));
    mocks.workspace.currentWorkspace = { id: 2 };
    rerender();
    await waitFor(() => expect(result.current.data).toEqual(["Current data"]));
    await act(async () => old.reject(new Error("Old workspace failed")));
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps the newest refresh result", async () => {
    const old = deferred<string[]>();
    const latest = deferred<string[]>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useWorkspaceData({ fetcher, initialData: [] as string[] }));
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetch(); });
    await act(async () => { latest.resolve(["Latest"]); await refresh; });
    await act(async () => old.resolve(["Old"]));
    expect(result.current.data).toEqual(["Latest"]);
  });

  it("reloads when the route resource changes within the same workspace", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(["Wishlist 1"]).mockResolvedValueOnce(["Wishlist 2"]);
    const { result, rerender } = renderHook(({ id }) => useWorkspaceData({ fetcher, resourceKey: id, initialData: [] as string[] }), { initialProps: { id: 1 } });
    await waitFor(() => expect(result.current.data).toEqual(["Wishlist 1"]));
    rerender({ id: 2 });
    expect(result.current.data).toEqual([]);
    await waitFor(() => expect(result.current.data).toEqual(["Wishlist 2"]));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ignores an old screen's data setter after a workspace switch", async () => {
    const fetcher = vi.fn().mockResolvedValue(["Current"]);
    const { result, rerender } = renderHook(() => useWorkspaceData({ fetcher, initialData: [] as string[] }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const oldSetData = result.current.setData;
    mocks.workspace.currentWorkspace = { id: 2 };
    rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => oldSetData(["Other workspace"]));
    expect(result.current.data).toEqual(["Current"]);
  });

  it("does not replace a local update with a pending stale fetch", async () => {
    const old = deferred<string[]>();
    const { result } = renderHook(() => useWorkspaceData({ fetcher: () => old.promise, initialData: [] as string[] }));
    act(() => result.current.setData((previous) => [...previous, "Saved item"]));
    await act(async () => old.resolve(["Old item"]));
    expect(result.current.data).toEqual(["Saved item"]);
    expect(result.current.isLoading).toBe(false);
  });
});
