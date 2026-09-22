import { useEffect, useState } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppBootstrapResponse, Holiday, Workspace } from "@niftygifty/types";
import { deferred } from "@/test/deferred";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false, user: { clerk_user_id: "user_a" } as { clerk_user_id: string } | null, hydrateBillingStatus: vi.fn() },
  get: vi.fn<(workspaceId?: number | null) => Promise<AppBootstrapResponse>>(),
  setWorkspaceId: vi.fn(),
}));
vi.mock("./auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/services", () => ({ bootstrapService: { get: mocks.get } }));
vi.mock("@/lib/api-client", () => ({ apiClient: { setWorkspaceId: mocks.setWorkspaceId } }));

function payload(id: number): AppBootstrapResponse {
  return {
    current_workspace_id: id,
    workspaces: [1, 2, 3].map((workspaceId) => ({ id: workspaceId, name: `Workspace ${workspaceId}`, workspace_type: workspaceId === 1 ? "personal" : "business" }) as Workspace),
    billing_status: { subscription_plan: "free", subscription_status: "free", subscription_expires_at: null, gift_count: 0, gifts_remaining: 20, can_create_gift: true, free_limit: 20 },
    data: { holidays: [{ id } as Holiday], people: [], gift_exchanges: [], gift_statuses: [], holiday_templates: [], pending_gifts: [], gift_total: 0, pending_gift_total: 0 },
  };
}

beforeEach(() => {
  mocks.auth.isAuthenticated = true;
  mocks.auth.isLoading = false;
  mocks.auth.user = { clerk_user_id: "user_a" };
  mocks.get.mockReset().mockResolvedValue(payload(1));
});

async function loadedWorkspace() {
  const hook = renderHook(useWorkspace, { wrapper: WorkspaceProvider });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("workspace request isolation", () => {
  it("keeps the latest workspace when bootstrap responses arrive out of order", async () => {
    const { result } = await loadedWorkspace();
    const older = deferred<AppBootstrapResponse>();
    const latest = deferred<AppBootstrapResponse>();
    mocks.get.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    act(() => result.current.switchWorkspace(2));
    act(() => result.current.switchWorkspace(3));
    await act(async () => latest.resolve(payload(3)));
    await act(async () => older.resolve(payload(2)));
    expect(result.current.currentWorkspace?.id).toBe(3);
    expect(result.current.bootstrapData?.holidays[0].id).toBe(3);
    expect(mocks.setWorkspaceId).toHaveBeenLastCalledWith(3);
  });

  it("does not finish loading when an obsolete request finishes", async () => {
    const { result } = await loadedWorkspace();
    const older = deferred<AppBootstrapResponse>();
    const latest = deferred<AppBootstrapResponse>();
    mocks.get.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    act(() => result.current.switchWorkspace(2));
    act(() => result.current.switchWorkspace(3));
    await act(async () => older.resolve(payload(2)));
    expect(result.current.isLoading).toBe(true);
    await act(async () => latest.resolve(payload(3)));
    expect(result.current.isLoading).toBe(false);
  });

  it("does not restore workspace data or headers after sign-out", async () => {
    const request = deferred<AppBootstrapResponse>();
    mocks.get.mockReturnValue(request.promise);
    const { result, rerender } = renderHook(useWorkspace, { wrapper: WorkspaceProvider });
    mocks.auth.isAuthenticated = false;
    mocks.auth.user = null;
    rerender();
    await act(async () => request.resolve(payload(1)));
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.bootstrapData).toBeNull();
    expect(mocks.setWorkspaceId).toHaveBeenLastCalledWith(null);
    expect(mocks.auth.hydrateBillingStatus).not.toHaveBeenCalled();
  });

  it("clears data and loads a fresh bootstrap when switching accounts directly", async () => {
    const { result, rerender } = await loadedWorkspace();
    const next = deferred<AppBootstrapResponse>();
    mocks.get.mockReturnValue(next.promise);
    mocks.auth.user = { clerk_user_id: "user_b" };
    rerender();
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.bootstrapData).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve(payload(3)));
    expect(result.current.currentWorkspace?.id).toBe(3);
  });

  it("ignores a refresh callback retained by the previous workspace", async () => {
    const { result } = await loadedWorkspace();
    const refreshPrevious = result.current.refreshWorkspaces;
    mocks.get.mockResolvedValue(payload(2));
    await act(async () => result.current.switchWorkspace(2));
    mocks.get.mockClear();
    await act(async () => refreshPrevious());
    expect(mocks.get).not.toHaveBeenCalled();
    expect(result.current.currentWorkspace?.id).toBe(2);
  });

  it("resets page forms and detaches old loader completions on workspace and account changes", async () => {
    let publishPageData: (value: string) => void = () => {};
    function Page() {
      const workspace = useWorkspace();
      const [data, setData] = useState("");
      useEffect(() => { publishPageData = setData; }, []);
      return <>
        <input aria-label="Page data" value={data} onChange={(event) => setData(event.target.value)} />
        <span>Active workspace {workspace.currentWorkspace?.id}</span>
        <button onClick={() => workspace.switchWorkspace(2)}>Switch workspace</button>
      </>;
    }
    const view = render(<WorkspaceProvider><Page /></WorkspaceProvider>);
    await screen.findByText("Active workspace 1");
    fireEvent.change(screen.getByLabelText("Page data"), { target: { value: "Private first workspace draft" } });
    const finishOldLoad = publishPageData;
    mocks.get.mockResolvedValue(payload(2));
    fireEvent.click(screen.getByRole("button", { name: "Switch workspace" }));
    await screen.findByText("Active workspace 2");
    act(() => finishOldLoad("Obsolete response"));
    expect((screen.getByLabelText("Page data") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Page data"), { target: { value: "Account A draft" } });
    mocks.auth.user = { clerk_user_id: "user_b" };
    view.rerender(<WorkspaceProvider><Page /></WorkspaceProvider>);
    expect((screen.getByLabelText("Page data") as HTMLInputElement).value).toBe("");
    await screen.findByText("Active workspace 2");
  });

  it("can load workspaces when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    const { result } = await loadedWorkspace();
    expect(result.current.currentWorkspace?.id).toBe(1);
  });

  it("offers a retry after bootstrap fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.get.mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValue(payload(1));
    const { result } = renderHook(useWorkspace, { wrapper: WorkspaceProvider });
    await screen.findByRole("alert");
    expect(result.current.isLoading).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(result.current.currentWorkspace?.id).toBe(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not change the API workspace after its provider unmounts", async () => {
    const request = deferred<AppBootstrapResponse>();
    mocks.get.mockReturnValue(request.promise);
    const { unmount } = renderHook(useWorkspace, { wrapper: WorkspaceProvider });
    unmount();
    mocks.setWorkspaceId.mockClear();
    await act(async () => request.resolve(payload(1)));
    expect(mocks.setWorkspaceId).not.toHaveBeenCalled();
  });
});
