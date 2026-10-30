import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeInviteDetails } from "@niftygifty/types";
import JoinExchangePage from "./page";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false, user: null as { email: string } | null },
  getInviteDetails: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/services", () => ({
  exchangeInvitesService: { getInviteDetails: mocks.getInviteDetails },
  AUTH_ROUTES: { signIn: "/login", signUp: "/signup" },
}));

function inviteDetails(overrides: Partial<ExchangeInviteDetails> = {}): ExchangeInviteDetails {
  return {
    exchange: {
      id: 1,
      name: "Family Christmas",
      slug: "family-christmas",
      exchange_date: null,
      budget_min: null,
      budget_max: null,
      owner_name: "Sam",
    },
    participant: { name: "Alex", email: "alex@example.com", status: "invited" },
    ...overrides,
  };
}

async function renderPage(token = "invite-token") {
  const params = Promise.resolve({ token });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <JoinExchangePage params={params} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  mocks.auth = { isAuthenticated: false, isLoading: false, user: null };
  mocks.getInviteDetails.mockReset().mockResolvedValue(inviteDetails());
});

describe("exchange invite page", () => {
  it("brings a logged-out person back to the invite after signing in or signing up", async () => {
    await renderPage();
    const signIn = screen.getByRole("link", { name: "Sign In" });
    const signUp = screen.getByRole("link", { name: "Sign Up" });
    expect(signIn.getAttribute("href")).toBe("/login?redirect_url=%2Fjoin%2Fexchange%2Finvite-token");
    expect(signUp.getAttribute("href")).toBe("/signup?redirect_url=%2Fjoin%2Fexchange%2Finvite-token");
  });
});
