import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StandaloneWishlistItem, WishlistWithItems } from "@niftygifty/types";
import { ApiError } from "@/lib/api-client";
import PublicWishlistPage from "./page";

const mocks = vi.hoisted(() => ({
  getPublicWishlist: vi.fn(),
  publicClaimItem: vi.fn(),
  auth: { isLoading: false, isAuthenticated: false },
  toastError: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => mocks.auth }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  wishlistsService: {
    getPublicWishlist: mocks.getPublicWishlist,
    publicClaimItem: mocks.publicClaimItem,
  },
}));

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
  mocks.toastError.mockReset();
  mocks.auth.isAuthenticated = false;
});

describe("guest wishlist claim form", () => {
  it("names the claim button after the item, since its text is hidden on mobile", async () => {
    await renderPage();
    expect(screen.getByLabelText("Claim this Lego set to reserve it")).toBeTruthy();
  });

  it("connects the name and email fields to their labels", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set to reserve it"));
    expect(screen.getByLabelText(/Your Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Your Email/)).toBeTruthy();
  });

  it("offers browser autofill so a guest doesn't retype their details", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set to reserve it"));
    expect(screen.getByLabelText(/Your Name/).getAttribute("autocomplete")).toBe("name");
    expect(screen.getByLabelText(/Your Email/).getAttribute("autocomplete")).toBe("email");
  });

  it("exposes the purchased choice as a labelled group of pressed buttons", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set to reserve it"));
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

describe("after a guest claims an item", () => {
  async function claim() {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set to reserve it"));
    fireEvent.change(screen.getByLabelText(/Your Name/), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText(/Your Email/), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim Item" }));
    await waitFor(() => expect(mocks.publicClaimItem).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }

  it("shows the last available item as claimed", async () => {
    await claim();
    expect(screen.getByText("Claimed")).toBeTruthy();
    expect(screen.queryByLabelText("Claim this Lego set to reserve it")).toBeNull();
  });

  it("keeps an item claimable while more of it are available", async () => {
    mocks.getPublicWishlist.mockResolvedValue(wishlist([{ ...item, quantity: 2, available_quantity: 2 }]));
    await claim();
    expect(screen.queryByText("Claimed")).toBeNull();
    expect(screen.getByLabelText("Claim this Lego set to reserve it")).toBeTruthy();
  });
});

describe("an owner opening their own share link", () => {
  beforeEach(() => {
    mocks.getPublicWishlist.mockReset();
    mocks.auth.isLoading = false;
  });

  async function renderLink() {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PublicWishlistPage params={Promise.resolve({ token: "abc" })} />
        </Suspense>
      );
    });
  }

  it("waits for sign-in to load, so the owner isn't treated as a guest", async () => {
    mocks.auth.isLoading = true;
    mocks.getPublicWishlist.mockResolvedValue(wishlist());
    await renderLink();

    expect(mocks.getPublicWishlist).not.toHaveBeenCalled();
  });

  it("says it's their list and offers no claim button", async () => {
    mocks.getPublicWishlist.mockResolvedValue({ ...wishlist(), id: 7, viewer_is_owner: true });
    await renderLink();

    expect(await screen.findByText(/This is your wishlist/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Manage your wishlist/ }).getAttribute("href")).toBe("/wishlists/7");
    expect(screen.queryByRole("button", { name: /Claim this/ })).toBeNull();
  });

  it("still lets guests claim", async () => {
    mocks.getPublicWishlist.mockResolvedValue(wishlist());
    await renderLink();

    expect(await screen.findByRole("button", { name: /Claim this/ })).toBeTruthy();
    expect(screen.queryByText(/This is your wishlist/)).toBeNull();
  });
});

describe("a signed-out visitor", () => {
  it("is told to sign in to see what's taken", async () => {
    await renderPage();

    expect(screen.getByText(/Sign in to see what's already taken/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?redirect_url=%2Fw%2Fabc");
  });

  it("finds out an item is taken when they try to claim it", async () => {
    mocks.publicClaimItem.mockRejectedValue(new ApiError(409, { error: "Someone is already getting this one." }));
    await renderPage();
    fireEvent.click(screen.getByLabelText("Claim this Lego set to reserve it"));
    fireEvent.change(screen.getByLabelText(/Your Name/), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText(/Your Email/), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim Item" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Claimed")).toBeTruthy();
    expect(screen.queryByLabelText("Claim this Lego set to reserve it")).toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith("Someone is already getting this one. Pick something else?");
  });
});

describe("a signed-in friend", () => {
  it("isn't asked to sign in", async () => {
    mocks.auth.isAuthenticated = true;
    await renderPage();

    expect(screen.getByText(/The owner won't see what's/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});
