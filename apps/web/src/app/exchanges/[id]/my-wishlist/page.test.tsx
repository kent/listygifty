import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeParticipant, GiftExchange, WishlistItem } from "@niftygifty/types";
import MyWishlistPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getBySlug: vi.fn(),
  getItems: vi.fn(),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  giftExchangesService: { getBySlug: mocks.getBySlug },
  wishlistItemsService: {
    getAll: mocks.getItems,
    create: mocks.createItem,
    delete: mocks.deleteItem,
  },
}));

const timestamps = { created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };

const me: ExchangeParticipant = {
  ...timestamps,
  id: 2,
  gift_exchange_id: 7,
  user_id: 200,
  name: "Ana",
  status: "accepted",
  display_name: "Ana",
  has_user: true,
  wishlist_count: 0,
};

function exchange(overrides: Partial<GiftExchange> = {}): GiftExchange {
  return {
    ...timestamps,
    id: 7,
    name: "Family Christmas",
    slug: "family-christmas",
    exchange_date: null,
    status: "inviting",
    budget_min: null,
    budget_max: null,
    user_id: 100,
    is_owner: false,
    participant_count: 3,
    accepted_count: 2,
    published_at: null,
    can_publish: false,
    can_start: false,
    role: "participant",
    roles: ["participant"],
    capabilities: {
      organize: false,
      participate: true,
      view_match: false,
      nudge_match: false,
      publish: false,
      redo: false,
      delete: false,
    },
    my_participant: me,
    ...overrides,
  };
}

function item(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    ...timestamps,
    id: 40,
    exchange_participant_id: me.id,
    name: "Wool socks",
    description: null,
    link: null,
    price: null,
    photo_url: null,
    has_photo: false,
    ...overrides,
  };
}

async function renderPage() {
  const params = Promise.resolve({ id: "family-christmas" });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <MyWishlistPage params={params} />
      </Suspense>
    );
  });
  await screen.findByRole("heading", { name: "My Wishlist" });
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.getBySlug.mockReset();
  mocks.getItems.mockReset().mockResolvedValue([]);
  mocks.createItem.mockReset();
  mocks.deleteItem.mockReset().mockResolvedValue(undefined);
});

describe("my wishlist before names are drawn", () => {
  it.each(["draft", "inviting"] as const)("loads and adds items while %s", async (status) => {
    mocks.getBySlug.mockResolvedValue(exchange({ status }));
    mocks.createItem.mockResolvedValue(item());

    await renderPage();
    expect(mocks.getItems).toHaveBeenCalledWith(7, me.id);

    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
    fireEvent.change(screen.getByPlaceholderText("What would you like?"), {
      target: { value: "Wool socks" },
    });
    fireEvent.submit(screen.getByPlaceholderText("What would you like?").closest("form")!);

    expect(await screen.findByText("Wool socks")).toBeTruthy();
    await waitFor(() =>
      expect(mocks.createItem).toHaveBeenCalledWith(7, me.id, {
        name: "Wool socks",
        description: undefined,
        link: undefined,
        price: undefined,
      })
    );
  });

  it("works for an organizer who is also a participant", async () => {
    mocks.getBySlug.mockResolvedValue(exchange({ status: "draft", is_owner: true, user_id: 200 }));

    await renderPage();

    expect(mocks.getItems).toHaveBeenCalledWith(7, me.id);
    expect(screen.getByRole("button", { name: "Add Item" })).toBeTruthy();
  });

  it("turns away someone who isn't a participant", async () => {
    mocks.getBySlug.mockResolvedValue(exchange({ my_participant: null }));
    const params = Promise.resolve({ id: "family-christmas" });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <MyWishlistPage params={params} />
        </Suspense>
      );
    });

    expect(await screen.findByText("You are not a participant in this exchange")).toBeTruthy();
    expect(mocks.getItems).not.toHaveBeenCalled();
  });
});
