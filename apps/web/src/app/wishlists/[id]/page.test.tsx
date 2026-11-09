import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StandaloneWishlistItem, WishlistWithItems } from "@niftygifty/types";
import WishlistDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  wishlist: null as unknown,
  share: vi.fn(),
  revokeShare: vi.fn(),
  reorderItems: vi.fn(),
  setData: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/services", () => ({
  wishlistsService: { share: mocks.share, revokeShare: mocks.revokeShare, reorderItems: mocks.reorderItems },
}));
vi.mock("@/hooks", () => ({
  useWorkspaceData: () => ({
    data: mocks.wishlist,
    setData: mocks.setData,
    isLoading: false,
    error: null,
    user: null,
    signOut: vi.fn(),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const item = {
  id: 1,
  name: "Lego set",
  priority: 0,
  quantity: 1,
  is_available: true,
  my_claim: null,
} as unknown as StandaloneWishlistItem;

function wishlist(overrides: Partial<WishlistWithItems> = {}) {
  return {
    id: 7,
    name: "Birthday",
    is_owner: true,
    anti_spoiler_enabled: true,
    claimed_count: 0,
    share_url: "https://listygifty.test/w/abc",
    wishlist_items: [item],
    ...overrides,
  } as WishlistWithItems;
}

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <WishlistDetailPage params={Promise.resolve({ id: "7" })} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  mocks.wishlist = wishlist();
  mocks.share.mockReset().mockResolvedValue({
    share_token: "abc",
    share_url: "https://listygifty.test/w/abc",
    visibility: "shared",
  });
});

describe("sharing a wishlist", () => {
  const openShare = () => act(async () => { fireEvent.click(screen.getByLabelText("Share")); });

  it("says so when Share makes a private list shared", async () => {
    mocks.wishlist = wishlist({ visibility: "private" });
    await renderPage();
    await openShare();
    expect(screen.getByText("This list was private. It is now shared.")).toBeTruthy();
  });

  it("doesn't say so for a list that was already shared", async () => {
    mocks.wishlist = wishlist({ visibility: "shared" });
    await renderPage();
    await openShare();
    expect(screen.queryByText("This list was private. It is now shared.")).toBeNull();
  });

  it("turns the link off from the share dialog", async () => {
    mocks.revokeShare.mockReset().mockResolvedValue({ message: "Share link revoked", visibility: "private" });
    await renderPage();
    await openShare();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Turn off link" })); });
    expect(mocks.revokeShare).toHaveBeenCalledWith(7);
    expect(screen.queryByRole("textbox", { name: "Share link" })).toBeNull();
  });
});

describe("wishlist item form", () => {
  it("connects every field to its label", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Add Item"));

    for (const label of [/^Name/, "Notes", "Link", "Min Price", "Max Price", "Priority", "Quantity"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });
});

describe("wishlist control names", () => {
  it("names the header buttons, whose text is hidden on mobile", async () => {
    await renderPage();
    expect(screen.getByLabelText("Share")).toBeTruthy();
    expect(screen.getByLabelText("Reveal claims")).toBeTruthy();
    expect(screen.getByLabelText("Add Item")).toBeTruthy();
  });

  it("names the share dialog's link and copy button", async () => {
    await renderPage();
    await act(async () => { fireEvent.click(screen.getByLabelText("Share")); });
    expect(screen.getByRole("textbox", { name: "Share link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("names each item's menu after the item", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "Actions for Lego set" })).toBeTruthy();
  });

  it("names the Reserve and Purchased buttons after the item", async () => {
    mocks.wishlist = wishlist({ is_owner: false });
    await renderPage();
    expect(screen.getByLabelText("Reserve Lego set")).toBeTruthy();
    expect(screen.getByLabelText("Mark Lego set as purchased")).toBeTruthy();
  });

  it("names the icon-only claim controls after the item", async () => {
    const reserved = { ...item, is_available: false, my_claim: { status: "reserved" } } as unknown as StandaloneWishlistItem;
    mocks.wishlist = wishlist({ is_owner: false, wishlist_items: [reserved] });
    await renderPage();
    expect(screen.getByRole("button", { name: "Mark Lego set as purchased" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove claim on Lego set" })).toBeTruthy();
  });
});

describe("exchanges that show this list", () => {
  it("detail page says which exchanges see this list", async () => {
    mocks.wishlist = wishlist({
      visibility: "private",
      exchanges: [{ id: 5, name: "Giannone XMas 2026", slug: "giannone-xmas-2026", status: "active" }],
    });

    await renderPage();

    expect(screen.getByText("Your Secret Santa in Giannone XMas 2026 sees this list, even though it's private.")).toBeTruthy();
  });

  it("doesn't call a shared list private", async () => {
    mocks.wishlist = wishlist({
      visibility: "shared",
      exchanges: [{ id: 5, name: "Giannone XMas 2026", slug: "giannone-xmas-2026", status: "active" }],
    });

    await renderPage();

    expect(screen.getByText("Your Secret Santa in Giannone XMas 2026 sees this list.")).toBeTruthy();
  });

  it("says nothing for a list no exchange uses", async () => {
    mocks.wishlist = wishlist({ exchanges: [] });

    await renderPage();

    expect(screen.queryByText(/Your Secret Santa in/)).toBeNull();
  });
});

describe("putting a wishlist in order", () => {
  const second = { ...item, id: 2, name: "Board game" } as StandaloneWishlistItem;

  it("moves an item down", async () => {
    mocks.wishlist = wishlist({ wishlist_items: [item, second] });
    mocks.reorderItems.mockResolvedValue([second, item]);
    mocks.setData.mockReset();

    await renderPage();
    expect(screen.getByLabelText("Rank 1")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move Lego set down" }));
    });

    expect(mocks.reorderItems).toHaveBeenCalledWith(7, { 2: 0, 1: 1 });
    expect(mocks.setData).toHaveBeenCalledWith(expect.objectContaining({ wishlist_items: [second, item] }));
  });

  it("doesn't offer ordering to someone who doesn't own the list", async () => {
    mocks.wishlist = wishlist({ is_owner: false, wishlist_items: [item, second] });

    await renderPage();

    expect(screen.queryByRole("button", { name: "Move Lego set down" })).toBeNull();
  });
});
