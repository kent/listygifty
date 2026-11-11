import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import NewWishlistPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/services", () => ({ wishlistsService: { create: vi.fn() } }));
vi.mock("@/hooks", () => ({
  useWorkspaceData: () => ({ user: null, signOut: vi.fn(), isLoading: false }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Select measures itself; jsdom has no ResizeObserver.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

beforeEach(() => window.sessionStorage.clear());

describe("new wishlist form", () => {
  it("keeps a half-filled form through a refresh", async () => {
    const first = render(<NewWishlistPage />);
    fireEvent.change(screen.getByLabelText(/^Wishlist Name/), { target: { value: "My birthday" } });
    first.unmount();

    render(<NewWishlistPage />);
    await waitFor(() =>
      expect((screen.getByLabelText(/^Wishlist Name/) as HTMLInputElement).value).toBe("My birthday")
    );
  });

  it("names the Visibility select from its label", () => {
    render(<NewWishlistPage />);
    expect(screen.getByRole("combobox", { name: "Visibility" })).toBeTruthy();
  });

  it("names every other field", () => {
    render(<NewWishlistPage />);
    expect(screen.getByLabelText(/^Wishlist Name/)).toBeTruthy();
    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect(screen.getByLabelText(/^Target Date/)).toBeTruthy();
  });

  it("offers no way to see what people buy", () => {
    render(<NewWishlistPage />);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByText(/won't see what anyone reserves or buys/)).toBeTruthy();
  });
});
