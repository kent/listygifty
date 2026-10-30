import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateWorkspacePage from "./page";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ refreshWorkspaces: vi.fn(), switchWorkspace: vi.fn() }),
}));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  workspacesService: { create: vi.fn() },
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/workspaces/new");
});

describe("create workspace page when signed out", () => {
  it("comes back here after signing in", async () => {
    render(<CreateWorkspacePage />);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login?redirect_url=%2Fworkspaces%2Fnew"));
  });

  it("does not redirect during server rendering, where window doesn't exist", () => {
    renderToString(<CreateWorkspacePage />);
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
