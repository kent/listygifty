import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WishlistItem } from "@niftygifty/types";
import { ApiError } from "@/lib/api-client";
import { deferred } from "@/test/deferred";
import { MatchWishlist } from "./match-wishlist";

const mocks = vi.hoisted(() => ({ nudgeMatch: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn() }));

vi.mock("@/services", () => ({ giftExchangesService: { nudgeMatch: mocks.nudgeMatch } }));
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
