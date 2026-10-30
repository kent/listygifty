import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import WishlistsPage from "./page";

const mocks = vi.hoisted(() => ({ getAll: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { clerk_user_id: "user_a" }, signOut: vi.fn() }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 1 }, isLoading: false, error: null }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  wishlistsService: { getAll: mocks.getAll },
}));

beforeEach(() => {
  mocks.getAll.mockReset();
});

describe("wishlists page when the list can't be loaded", () => {
  it("explains a server failure instead of printing the raw error", async () => {
    mocks.getAll.mockRejectedValue(new ApiError(500, { error: "PG::ConnectionBad: connection refused" }));
    render(<WishlistsPage />);

    expect(await screen.findByText("The server hit a snag. Try again in a moment.")).toBeTruthy();
    expect(screen.queryByText(/PG::ConnectionBad/)).toBeNull();
  });

  it("explains a network failure in plain words", async () => {
    mocks.getAll.mockRejectedValue(new ApiError(0, { error: "Request timeout after 30000ms" }));
    render(<WishlistsPage />);

    expect(await screen.findByText("Couldn't reach the server. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText(/Request timeout/)).toBeNull();
  });
});
