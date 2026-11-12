import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeParticipant, GiftExchangeWithParticipants, WishlistAccess } from "@niftygifty/types";
import { ApiError } from "@/lib/api-client";
import ExchangeParticipantPage from "./page";

const mocks = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  getParticipant: vi.fn(),
  createRequest: vi.fn(),
  nudgeMatch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  giftExchangesService: { getBySlug: mocks.getBySlug, nudgeMatch: mocks.nudgeMatch },
  exchangeParticipantsService: { getById: mocks.getParticipant },
  wishlistAccessRequestsService: { create: mocks.createRequest },
}));

const timestamps = { created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };

function person(id: number, name: string, overrides: Partial<ExchangeParticipant> = {}): ExchangeParticipant {
  return {
    ...timestamps,
    id,
    gift_exchange_id: 7,
    user_id: id * 100,
    name,
    status: "accepted",
    display_name: name,
    has_user: true,
    wishlist_count: 1,
    ...overrides,
  };
}

const me = person(2, "Ana");

function exchange(overrides: Partial<GiftExchangeWithParticipants> = {}): GiftExchangeWithParticipants {
  return {
    ...timestamps,
    id: 7,
    name: "Family Christmas",
    slug: "family-christmas",
    exchange_date: null,
    status: "active",
    budget_min: null,
    budget_max: null,
    user_id: 100,
    is_owner: false,
    participant_count: 3,
    accepted_count: 3,
    published_at: timestamps.created_at,
    can_publish: false,
    can_start: false,
    role: "giver",
    roles: ["participant", "matcher"],
    capabilities: {
      organize: false,
      participate: true,
      view_match: true,
      nudge_match: true,
      publish: false,
      redo: false,
      delete: false,
    },
    my_participant: me,
    exchange_participants: [],
    ...overrides,
  };
}

function bea(access: WishlistAccess) {
  const visible = access === "match" || access === "approved";
  return person(3, "Bea", {
    wishlist_access: access,
    ...(visible
      ? {
          wishlist_items: [
            {
              ...timestamps,
              id: 9,
              exchange_participant_id: 3,
              name: "Wool socks",
              description: null,
              link: null,
              price: null,
              photo_url: null,
              has_photo: false,
            },
          ],
        }
      : {}),
  });
}

async function renderPage(participantId = "3") {
  const params = Promise.resolve({ id: "family-christmas", participantId });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ExchangeParticipantPage params={params} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBySlug.mockResolvedValue(exchange());
});

describe("someone you didn't draw", () => {
  it("can be asked for their wishlist", async () => {
    mocks.getParticipant.mockResolvedValue(bea("none"));
    mocks.createRequest.mockResolvedValue({ id: 41, status: "pending" });

    await renderPage();
    expect(await screen.findByText("Bea's wishlist is private")).toBeTruthy();
    expect(screen.queryByText("Wool socks")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask to see their wishlist" }));

    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledWith(7, 3));
    expect(await screen.findByText("Request sent")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask to see their wishlist" })).toBeNull();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Asked Bea");
  });

  it("keeps the button when the request fails, and says why", async () => {
    mocks.getParticipant.mockResolvedValue(bea("none"));
    mocks.createRequest.mockRejectedValue(new ApiError(422, { error: "They'd rather keep their wishlist private" }));

    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ask to see their wishlist" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("They'd rather keep their wishlist private"));
    expect(screen.getByRole("button", { name: "Ask to see their wishlist" })).toBeTruthy();
  });

  it.each<[WishlistAccess, string]>([
    ["pending", "Request sent"],
    ["denied", "Bea is keeping their wishlist private"],
    ["unavailable", "Bea hasn't joined yet"],
  ])("can't be asked again while %s", async (access, title) => {
    mocks.getParticipant.mockResolvedValue(bea(access));

    await renderPage();

    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask to see their wishlist" })).toBeNull();
  });

  it("shows their wishlist once they say yes, with no anonymous ask", async () => {
    mocks.getParticipant.mockResolvedValue(bea("approved"));

    await renderPage();

    expect(await screen.findByText("Wool socks")).toBeTruthy();
    expect(screen.queryByText(/getting a gift for/)).toBeNull();
    expect(screen.queryByRole("button", { name: /anonymously/ })).toBeNull();
  });
});

describe("the person you drew", () => {
  it("shows their wishlist straight away", async () => {
    mocks.getParticipant.mockResolvedValue(bea("match"));

    await renderPage();

    expect(await screen.findByText("Wool socks")).toBeTruthy();
    expect(screen.getByText("You're getting a gift for Bea")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask to see their wishlist" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ask for more ideas from Bea anonymously" })).toBeTruthy();
  });
});

describe("your own name", () => {
  it("points you to your own wishlist", async () => {
    mocks.getParticipant.mockResolvedValue(me);

    await renderPage("2");

    expect((await screen.findByRole("link", { name: "Edit your wishlist" })).getAttribute("href")).toBe(
      "/exchanges/family-christmas/my-wishlist"
    );
  });
});

describe("someone not taking part", () => {
  it("isn't shown anyone's wishlist", async () => {
    mocks.getBySlug.mockResolvedValue(exchange({ my_participant: null, is_owner: true }));
    mocks.getParticipant.mockResolvedValue(person(3, "Bea"));

    await renderPage();

    expect(await screen.findByText(/Only people taking part/)).toBeTruthy();
  });
});
