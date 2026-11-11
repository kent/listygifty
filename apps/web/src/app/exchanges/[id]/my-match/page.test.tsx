import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "@/test/deferred";
import MyMatchPage from "./page";

const mocks = vi.hoisted(() => ({ getBySlug: vi.fn(), getById: vi.fn(), nudgeMatch: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  giftExchangesService: { getBySlug: mocks.getBySlug, nudgeMatch: mocks.nudgeMatch },
  exchangeParticipantsService: { getById: mocks.getById },
}));

async function renderPage() {
  const params = Promise.resolve({ id: "family-christmas" });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <MyMatchPage params={params} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  mocks.nudgeMatch.mockReset();
  mocks.getBySlug.mockReset().mockResolvedValue({
    id: 7,
    name: "Family Christmas",
    slug: "family-christmas",
    status: "active",
    exchange_date: null,
    budget_min: null,
    budget_max: null,
    capabilities: { nudge_match: true },
    my_participant: { matched_participant_id: 2 },
  });
  mocks.getById.mockReset().mockResolvedValue({ display_name: "Ana", wishlist_items: [] });
});

describe("asking your match for ideas", () => {
  it("starts its accessible name with the visible label", async () => {
    await renderPage();
    const button = screen.getByRole("button", { name: "Ask for ideas from Ana anonymously" });
    expect(button.textContent).toBe("Ask for ideas");
  });

  it("reads the same as the button while sending", async () => {
    const request = deferred<void>();
    mocks.nudgeMatch.mockReturnValue(request.promise);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Ask for ideas/ }));

    const sending = await screen.findByRole("button", { name: "Sending..." });
    expect(sending.textContent).toBe("Sending...");
    await act(async () => request.resolve());
    expect(mocks.nudgeMatch).toHaveBeenCalledWith(7);
    expect(screen.getByRole("button", { name: "Request sent" })).toBeTruthy();
  });
});

describe("getting back to your own wishlist", () => {
  it("links to your own wishlist", async () => {
    await renderPage();

    const link = await screen.findByRole("link", { name: "Your wishlist" });
    expect(link.getAttribute("href")).toBe("/exchanges/family-christmas/my-wishlist");
  });

  it("numbers your match's ideas in their order", async () => {
    mocks.getById.mockResolvedValue({
      display_name: "Ana",
      wishlist_items: [
        { id: 1, name: "Mixer bowl", description: null, link: null, price: null, photo_url: null, has_photo: false },
        { id: 2, name: "Wool socks", description: null, link: null, price: null, photo_url: null, has_photo: false },
      ],
    });

    await renderPage();

    expect(await screen.findByLabelText("Rank 1")).toBeTruthy();
    expect(screen.getByLabelText("Rank 2")).toBeTruthy();
  });
});
