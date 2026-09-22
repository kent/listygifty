import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinHolidayPage from "./page";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  workspace: { isLoading: false, refreshWorkspaces: vi.fn().mockResolvedValue(undefined) },
  push: vi.fn(),
  join: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useParams: () => ({ token: "invitation-token" }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("@/services", () => ({ holidaysService: { join: mocks.join }, AUTH_ROUTES: { signIn: "/login" } }));

beforeEach(() => {
  mocks.auth = { isAuthenticated: false, isLoading: false };
  mocks.workspace.isLoading = false;
  mocks.join.mockReset().mockResolvedValue({ id: 42, name: "Family Gifts", date: null });
});

describe("gift list invitation", () => {
  it("preserves the invitation through sign-in and automatically joins on return", async () => {
    const { rerender } = render(<JoinHolidayPage />);
    expect(mocks.push).toHaveBeenCalledWith("/login?redirect_url=%2Fjoin%2Finvitation-token");
    expect(mocks.join).not.toHaveBeenCalled();

    mocks.auth = { isAuthenticated: true, isLoading: false };
    rerender(<JoinHolidayPage />);
    const link = await screen.findByRole("link", { name: "Open Gift List" });
    expect(mocks.join).toHaveBeenCalledWith("invitation-token");
    expect(mocks.workspace.refreshWorkspaces).toHaveBeenCalled();
    expect(link.getAttribute("href")).toBe("/holidays/42");
  });

  it("waits for auth and workspace initialization before accepting", async () => {
    mocks.auth = { isAuthenticated: true, isLoading: true };
    mocks.workspace.isLoading = true;
    const { rerender } = render(<JoinHolidayPage />);
    expect(mocks.join).not.toHaveBeenCalled();
    mocks.auth.isLoading = false;
    rerender(<JoinHolidayPage />);
    expect(mocks.join).not.toHaveBeenCalled();
    mocks.workspace.isLoading = false;
    rerender(<JoinHolidayPage />);
    await screen.findByRole("link", { name: "Open Gift List" });
    expect(mocks.join).toHaveBeenCalledTimes(1);
  });

  it("shows invalid invitations without claiming membership", async () => {
    mocks.auth = { isAuthenticated: true, isLoading: false };
    mocks.join.mockRejectedValue(new Error("Invalid share link"));
    render(<JoinHolidayPage />);
    await waitFor(() => expect(screen.getByText("Invalid share link")).toBeTruthy());
    expect(screen.queryByRole("link", { name: "Open Gift List" })).toBeNull();
    expect(mocks.workspace.refreshWorkspaces).not.toHaveBeenCalled();
  });
});
