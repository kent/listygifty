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
    my_participant: { matched_participant_id: 2 },
  });
  mocks.getById.mockReset().mockResolvedValue({ display_name: "Ana", wishlist_items: [] });
});

describe("asking your match for more ideas", () => {
  it("starts its accessible name with the visible label", async () => {
    await renderPage();
    const button = screen.getByRole("button", { name: "Ask for more ideas from Ana anonymously" });
    expect(button.textContent).toBe("Ask for more ideas");
  });

  it("reads the same as the button while sending", async () => {
    const request = deferred<void>();
    mocks.nudgeMatch.mockReturnValue(request.promise);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Ask for more ideas/ }));

    const sending = await screen.findByRole("button", { name: "Sending..." });
    expect(sending.textContent).toBe("Sending...");
    await act(async () => request.resolve());
    expect(screen.getByRole("button", { name: /^Ask for more ideas/ })).toBeTruthy();
  });
});
