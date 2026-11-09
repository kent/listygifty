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
  reorder: vi.fn(),
  myWishlists: vi.fn(),
  chooseWishlist: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  giftExchangesService: { getBySlug: mocks.getBySlug },
  wishlistItemsService: {
    getAll: mocks.getItems,
    create: mocks.createItem,
    delete: mocks.deleteItem,
    reorder: mocks.reorder,
  },
  wishlistsService: { getAll: mocks.myWishlists },
  exchangeParticipantsService: { chooseWishlist: mocks.chooseWishlist },
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
  mocks.reorder.mockReset();
  mocks.myWishlists.mockReset().mockResolvedValue([]);
  mocks.chooseWishlist.mockReset();
  mocks.toastError.mockReset();
});

describe("my wishlist for assistive tech", () => {
  it("ties every field in the add form to its label", async () => {
    mocks.getBySlug.mockResolvedValue(exchange());

    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(screen.getByLabelText("Name *")).toBe(screen.getByPlaceholderText("What would you like?"));
    expect(screen.getByLabelText("Description")).toBe(
      screen.getByPlaceholderText("Size, color, or other details...")
    );
    expect(screen.getByLabelText("Link")).toBe(screen.getByPlaceholderText("https://..."));
    expect(screen.getByLabelText("Approximate Price ($)")).toBe(screen.getByPlaceholderText("25.00"));
  });

  it("says which item each remove button removes", async () => {
    mocks.getBySlug.mockResolvedValue(exchange());
    mocks.getItems.mockResolvedValue([item()]);

    await renderPage();
    await screen.findByText("Wool socks");

    fireEvent.click(screen.getByRole("button", { name: "Remove Wool socks" }));

    await waitFor(() => expect(mocks.deleteItem).toHaveBeenCalledWith(7, me.id, 40));
  });
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

describe("my wishlist is in my order", () => {
  const socks = item({ id: 40, name: "Wool socks", position: 0 });
  const mixer = item({ id: 41, name: "Mixer bowl", position: 1 });

  it("shows rank numbers and moves an item up", async () => {
    mocks.getBySlug.mockResolvedValue(exchange());
    mocks.getItems.mockResolvedValue([socks, mixer]);
    mocks.reorder.mockResolvedValue([mixer, socks]);

    await renderPage();
    await screen.findByText("Mixer bowl");
    expect(screen.getByText(/Your Secret Santa sees these in this order/)).toBeTruthy();
    expect(screen.getByLabelText("Rank 2")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Move Wool socks up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move Mixer bowl down" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move Mixer bowl up" }));
    });

    expect(mocks.reorder).toHaveBeenCalledWith(7, me.id, [41, 40]);
    const names = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(["Mixer bowl", "Wool socks"]);
  });

  it("reorder failure reloads items", async () => {
    mocks.getBySlug.mockResolvedValue(exchange());
    mocks.getItems.mockResolvedValue([socks, mixer]);
    mocks.reorder.mockRejectedValue(new Error("stale"));

    await renderPage();
    await screen.findByText("Mixer bowl");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move Mixer bowl up" }));
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Couldn't save the new order"));
    expect(mocks.getItems).toHaveBeenCalledTimes(2);
  });
});

describe("which wishlist this exchange uses", () => {
  const myWishlist = { id: 9, name: "My Wishlist", item_count: 1 };

  it("shows which wishlist this exchange uses", async () => {
    mocks.getBySlug.mockResolvedValue(exchange({ my_participant: { ...me, wishlist: myWishlist } }));

    await renderPage();

    expect(screen.getByText(/This is your wishlist/)).toBeTruthy();
    expect(screen.getByText("My Wishlist", { selector: "strong" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open in Wishlists" }).getAttribute("href")).toBe("/wishlists/9");
    expect(screen.queryByLabelText("Use a different wishlist")).toBeNull();
  });

  it("lets you switch to another of your wishlists", async () => {
    mocks.getBySlug.mockResolvedValue(exchange({ my_participant: { ...me, wishlist: myWishlist } }));
    mocks.myWishlists.mockResolvedValue([
      { id: 9, name: "My Wishlist", is_owner: true },
      { id: 12, name: "Birthday", is_owner: true },
      { id: 30, name: "Bob's list", is_owner: false },
    ]);
    mocks.chooseWishlist.mockResolvedValue({ ...me, wishlist: { id: 12, name: "Birthday", item_count: 0 } });

    await renderPage();
    const picker = (await screen.findByLabelText("Use a different wishlist")) as HTMLSelectElement;
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual(["My Wishlist", "Birthday"]);

    await act(async () => {
      fireEvent.change(picker, { target: { value: "12" } });
    });

    expect(mocks.chooseWishlist).toHaveBeenCalledWith(7, me.id, 12);
    expect(mocks.getItems).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Birthday", { selector: "strong" })).toBeTruthy();
  });
});

describe("prices", () => {
  it("shows the range the API sends", async () => {
    mocks.getBySlug.mockResolvedValue(exchange());
    mocks.getItems.mockResolvedValue([item({ price: "40.0", price_display: "$20.00 - $40.00" })]);

    await renderPage();

    expect(await screen.findByText("$20.00 - $40.00")).toBeTruthy();
  });

  it("falls back to price when price_display is missing (old API)", async () => {
    mocks.getBySlug.mockResolvedValue(exchange());
    mocks.getItems.mockResolvedValue([item({ price: "25.0" })]);

    await renderPage();

    expect(await screen.findByText("$25.00")).toBeTruthy();
  });
});
