import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GiftExchange } from "@niftygifty/types";
import ExchangesPage from "./page";

const mocks = vi.hoisted(() => ({
  workspaceData: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/hooks", () => ({ useWorkspaceData: mocks.workspaceData }));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("@/services", () => ({ giftExchangesService: { getAll: vi.fn() } }));

const exchange = {
  id: 7,
  name: "Family Christmas",
  slug: "family-christmas",
  exchange_date: null,
  status: "inviting",
  is_owner: true,
  accepted_count: 1,
  participant_count: 3,
} as GiftExchange;

function loaded(overrides: Partial<{ data: GiftExchange[]; isLoading: boolean; error: string | null }>) {
  mocks.workspaceData.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
    user: null,
    signOut: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  mocks.workspaceData.mockReset();
  mocks.refetch.mockReset();
});

describe("the exchanges list", () => {
  it("doesn't claim there are no exchanges while it's loading", () => {
    loaded({ isLoading: true });

    render(<ExchangesPage />);

    expect(screen.queryByText("No Exchanges Yet")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading exchanges" })).toBeTruthy();
  });

  it("doesn't claim there are no exchanges when the load failed", () => {
    loaded({ error: "Request failed with status 500" });

    render(<ExchangesPage />);

    expect(screen.queryByText("No Exchanges Yet")).toBeNull();
    expect(screen.queryByText("Create Your First Exchange")).toBeNull();
    expect(screen.queryByText("Request failed with status 500")).toBeNull();
    expect(screen.getByText("We couldn't load your exchanges")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("offers to create one when there really are none", () => {
    loaded({});

    render(<ExchangesPage />);

    expect(screen.getByText("No Exchanges Yet")).toBeTruthy();
    expect(screen.getByText("Create Your First Exchange")).toBeTruthy();
  });

  it("keeps showing exchanges it already has while refreshing or after a failed refresh", () => {
    loaded({ data: [exchange], isLoading: true });
    const { rerender } = render(<ExchangesPage />);
    expect(screen.getByText("Family Christmas")).toBeTruthy();

    loaded({ data: [exchange], error: "offline" });
    rerender(<ExchangesPage />);
    expect(screen.getByText("Family Christmas")).toBeTruthy();
  });
});
