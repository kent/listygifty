import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WishlistItem } from "@niftygifty/types";
import { ApiError } from "@/lib/api-client";
import { deferred } from "@/test/deferred";
import { MatchWishlist } from "./match-wishlist";

const mocks = vi.hoisted(() => ({
  nudgeMatch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  claim: vi.fn(),
  markPurchased: vi.fn(),
  unclaim: vi.fn(),
}));

vi.mock("@/services", () => ({
  giftExchangesService: { nudgeMatch: mocks.nudgeMatch },
  wishlistItemsService: { claim: mocks.claim, markPurchased: mocks.markPurchased, unclaim: mocks.unclaim },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

function item(id: number, name: string): WishlistItem {
  return {
    id,
    name,
    exchange_participant_id: 2,
    description: null,
    link: null,
    price: null,
    photo_url: null,
    has_photo: false,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  };
}

function renderWishlist(items: WishlistItem[], canNudge = true) {
  render(<MatchWishlist exchangeId={7} matchName="Ana" items={items} canNudge={canNudge} />);
}

beforeEach(() => {
  mocks.nudgeMatch.mockReset().mockResolvedValue(undefined);
});

describe("a match with ideas", () => {
  it("lists them in their order", () => {
    renderWishlist([item(1, "Mixer bowl"), item(2, "Wool socks")]);

    expect(screen.getByRole("heading", { name: "Ana's wishlist" })).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["1Mixer bowl", "2Wool socks"]);
  });

  it("can still ask for more", () => {
    renderWishlist([item(1, "Mixer bowl")]);

    const button = screen.getByRole("button", { name: "Ask for more ideas from Ana anonymously" });
    expect(button.textContent).toBe("Ask for more ideas");
    expect(screen.queryByText("No ideas yet")).toBeNull();
  });
});

describe("a match with no ideas", () => {
  it("says so and offers to ask them anonymously", () => {
    renderWishlist([]);

    expect(screen.getByText("No ideas yet")).toBeTruthy();
    expect(screen.getByText("We'll email them. They won't know it was you.")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Ask for ideas from Ana anonymously" });
    expect(button.textContent).toBe("Ask for ideas");
  });

  it("sends one request and says it's on its way", async () => {
    const request = deferred<void>();
    mocks.nudgeMatch.mockReturnValue(request.promise);
    renderWishlist([]);

    fireEvent.click(screen.getByRole("button", { name: /^Ask for ideas/ }));
    expect(screen.getByRole("button", { name: "Sending..." })).toHaveProperty("disabled", true);
    await act(async () => request.resolve());

    expect(mocks.nudgeMatch).toHaveBeenCalledWith(7);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Anonymous request sent");
    expect(screen.getByRole("button", { name: "Request sent" })).toHaveProperty("disabled", true);
    expect(screen.getByText("We'll email you when they add one.")).toBeTruthy();
  });

  it("shows why a request was refused and lets them try again", async () => {
    mocks.nudgeMatch.mockRejectedValue(
      new ApiError(422, { error: "Your anonymous request was already sent in the last 24 hours" })
    );
    renderWishlist([]);

    fireEvent.click(screen.getByRole("button", { name: /^Ask for ideas/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Your anonymous request was already sent in the last 24 hours")
    );
    expect(screen.getByRole("button", { name: /^Ask for ideas/ })).toHaveProperty("disabled", false);
  });

  it("doesn't offer to ask a match who deleted their account", () => {
    renderWishlist([], false);

    expect(screen.getByText("No ideas yet")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Check back later.")).toBeTruthy();
  });
});

describe("marking what you're getting", () => {
  const bowl = item(1, "Mixer bowl");
  const open: WishlistItem = { ...bowl, is_available: true, claimed_quantity: 0, my_claim: null };
  const reserved: WishlistItem = { ...bowl, is_available: false, claimed_quantity: 1, my_claim: { status: "reserved" } };
  const bought: WishlistItem = { ...bowl, is_available: false, claimed_quantity: 1, my_claim: { status: "purchased" } };
  const taken: WishlistItem = { ...bowl, is_available: false, claimed_quantity: 1, my_claim: null };

  beforeEach(() => {
    mocks.claim.mockReset();
    mocks.markPurchased.mockReset();
    mocks.unclaim.mockReset();
    mocks.toastError.mockReset();
  });

  it("offers nothing when the API is too old to say what's taken", () => {
    renderWishlist([bowl]);

    expect(screen.getByText("Mixer bowl")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reserve Mixer bowl" })).toBeNull();
    expect(screen.queryByText(/Ana can't see it/)).toBeNull();
  });

  it("says the owner can't see what you mark", () => {
    renderWishlist([open]);

    expect(screen.getByText("Mark what you're getting so nobody doubles up. Ana can't see it.")).toBeTruthy();
  });

  it("reserves an item", async () => {
    mocks.claim.mockResolvedValue(reserved);
    renderWishlist([open]);

    fireEvent.click(screen.getByRole("button", { name: "Reserve Mixer bowl" }));

    expect(await screen.findByText("Reserved")).toBeTruthy();
    expect(mocks.claim).toHaveBeenCalledWith(7, 2, 1, false);
    expect(screen.queryByRole("button", { name: "Reserve Mixer bowl" })).toBeNull();
  });

  it("marks an item bought in one step", async () => {
    mocks.claim.mockResolvedValue(bought);
    renderWishlist([open]);

    fireEvent.click(screen.getByRole("button", { name: "Mark Mixer bowl as bought" }));

    expect(await screen.findByText("Bought")).toBeTruthy();
    expect(mocks.claim).toHaveBeenCalledWith(7, 2, 1, true);
  });

  it("turns a reserved item into a bought one", async () => {
    mocks.markPurchased.mockResolvedValue(bought);
    renderWishlist([reserved]);

    fireEvent.click(screen.getByRole("button", { name: "Mark Mixer bowl as bought" }));

    expect(await screen.findByText("Bought")).toBeTruthy();
    expect(mocks.markPurchased).toHaveBeenCalledWith(7, 2, 1);
  });

  it("undoes a mark", async () => {
    mocks.unclaim.mockResolvedValue(open);
    renderWishlist([bought]);

    fireEvent.click(screen.getByRole("button", { name: "Undo your mark on Mixer bowl" }));

    expect(await screen.findByRole("button", { name: "Reserve Mixer bowl" })).toBeTruthy();
    expect(mocks.unclaim).toHaveBeenCalledWith(7, 2, 1);
  });

  it("shows an item someone else has, with nothing to press", () => {
    renderWishlist([taken]);

    expect(screen.getByText("Someone has this")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reserve Mixer bowl" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo your mark on Mixer bowl" })).toBeNull();
  });

  it("tells you when someone got there first, and marks it taken", async () => {
    mocks.claim.mockRejectedValue(
      new ApiError(409, { error: "Someone is already getting this one.", code: "already_claimed" })
    );
    renderWishlist([open]);

    fireEvent.click(screen.getByRole("button", { name: "Reserve Mixer bowl" }));

    expect(await screen.findByText("Someone has this")).toBeTruthy();
    expect(mocks.toastError).toHaveBeenCalledWith("Someone is already getting this one. Pick something else?");
    expect(screen.queryByRole("button", { name: "Reserve Mixer bowl" })).toBeNull();
  });

  it("keeps the buttons when marking fails for another reason", async () => {
    mocks.claim.mockRejectedValue(new ApiError(500, { error: "Server fell over" }));
    renderWishlist([open]);

    fireEvent.click(screen.getByRole("button", { name: "Reserve Mixer bowl" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Reserve Mixer bowl" })).toBeTruthy();
  });

  it("holds every item's buttons while one is saving", async () => {
    const saving = deferred<WishlistItem>();
    mocks.claim.mockReturnValue(saving.promise);
    renderWishlist([open, { ...open, id: 2, name: "Wool socks" }]);

    fireEvent.click(screen.getByRole("button", { name: "Reserve Mixer bowl" }));

    expect((screen.getByRole("button", { name: "Reserve Wool socks" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => saving.resolve(reserved));
    expect((screen.getByRole("button", { name: "Reserve Wool socks" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
