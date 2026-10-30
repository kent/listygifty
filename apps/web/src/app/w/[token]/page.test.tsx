import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StandaloneWishlistItem, WishlistWithItems } from "@niftygifty/types";
import PublicWishlistPage from "./page";

const mocks = vi.hoisted(() => ({
  getPublicWishlist: vi.fn(),
  publicClaimItem: vi.fn(),
}));

vi.mock("@/services", () => ({
  wishlistsService: {
    getPublicWishlist: mocks.getPublicWishlist,
    publicClaimItem: mocks.publicClaimItem,
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const item = {
  id: 1,
  name: "Lego set",
  priority: 0,
  quantity: 1,
  is_available: true,
  available_quantity: 1,
  claimed_quantity: 0,
} as unknown as StandaloneWishlistItem;

function wishlist(items: StandaloneWishlistItem[] = [item]) {
  return { id: 7, name: "Birthday", wishlist_items: items } as WishlistWithItems;
}

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PublicWishlistPage params={Promise.resolve({ token: "abc" })} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  mocks.getPublicWishlist.mockReset().mockResolvedValue(wishlist());
  mocks.publicClaimItem.mockReset().mockResolvedValue({});
});

describe("guest wishlist claim form", () => {
  it("names the claim button after the item, since its text is hidden on mobile", async () => {
    await renderPage();
    expect(screen.getByLabelText("Claim this Lego set")).toBeTruthy();
  });

  it("connects the name and email fields to their labels", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set"));
    expect(screen.getByLabelText(/Your Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Your Email/)).toBeTruthy();
  });

  it("offers browser autofill so a guest doesn't retype their details", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set"));
    expect(screen.getByLabelText(/Your Name/).getAttribute("autocomplete")).toBe("name");
    expect(screen.getByLabelText(/Your Email/).getAttribute("autocomplete")).toBe("email");
  });

  it("exposes the purchased choice as a labelled group of pressed buttons", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set"));
    const planning = screen.getByRole("button", { name: "Planning to Buy" });
    const purchased = screen.getByRole("button", { name: "Already Purchased" });
    expect(screen.getByRole("group", { name: "Have you already purchased it?" })).toBeTruthy();
    expect(planning.getAttribute("aria-pressed")).toBe("true");
    expect(purchased.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(purchased);
    expect(planning.getAttribute("aria-pressed")).toBe("false");
    expect(purchased.getAttribute("aria-pressed")).toBe("true");
  });
});
