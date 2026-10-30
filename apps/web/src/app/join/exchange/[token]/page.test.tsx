import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeInviteDetails } from "@niftygifty/types";
import { ApiError } from "@/lib/api-client";
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
    join_open: true,
    closed_reason: null,
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

  it("explains the app to a logged-out stranger above the sign-in sentence", async () => {
    await renderPage();
    const explainer = screen.getByText("Listy Gifty draws names so everyone gets one person to buy for. It's free.");
    const signInSentence = screen.getByText("Sign in or create an account to join this exchange");
    expect(explainer.compareDocumentPosition(signInSentence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows friendly copy instead of the raw error for an invalid invite", async () => {
    mocks.getInviteDetails.mockRejectedValue(new ApiError(404, { error: "Invalid or expired invite link" }));
    await renderPage();
    expect(screen.getByRole("heading", { name: "Invalid Invite" })).toBeTruthy();
    expect(screen.getByText("This invite link doesn't work anymore. Ask the person who invited you for a new one.")).toBeTruthy();
    expect(screen.queryByText(/Invalid or expired/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  describe("when the invite can't be loaded", () => {
    const failures: Array<[string, Error]> = [
      ["the network is down", new ApiError(0, { error: "Request timeout after 30000ms" })],
      ["the server is having a bad time", new ApiError(503, undefined)],
      ["fetch itself fails", new TypeError("Failed to fetch")],
    ];

    it.each(failures)("doesn't call the link dead when %s", async (_, failure) => {
      mocks.getInviteDetails.mockRejectedValue(failure);
      await renderPage();
      expect(screen.getByText("We couldn't load this invite. Check your connection and try again.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Invalid Invite" })).toBeNull();
      expect(screen.queryByText(/doesn't work anymore/)).toBeNull();
    });

    it("loads the invite again from Try again", async () => {
      mocks.getInviteDetails.mockRejectedValueOnce(new ApiError(503, undefined));
      await renderPage();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      });
      expect(mocks.getInviteDetails).toHaveBeenCalledTimes(2);
      expect(screen.getByText("You Are Invited!")).toBeTruthy();
      expect(screen.queryByText(/couldn't load this invite/)).toBeNull();
    });

    it("says the link is dead if the retry comes back with a 404", async () => {
      mocks.getInviteDetails
        .mockRejectedValueOnce(new ApiError(503, undefined))
        .mockRejectedValueOnce(new ApiError(404, { error: "Invalid or expired invite link" }));
      await renderPage();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      });
      expect(screen.getByRole("heading", { name: "Invalid Invite" })).toBeTruthy();
      expect(screen.queryByText(/couldn't load this invite/)).toBeNull();
    });
  });

  describe("when the exchange has closed", () => {
    const closed = { join_open: false, closed_reason: "Names have already been drawn." };

    it("tells an invited person why and who to ask, with no way to join", async () => {
      mocks.getInviteDetails.mockResolvedValue(inviteDetails(closed));
      await renderPage();
      expect(screen.getByRole("heading", { name: "This exchange has closed" })).toBeTruthy();
      expect(screen.getByText("Names have already been drawn.")).toBeTruthy();
      expect(screen.getByText("Ask Sam if you think you should be in.")).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
    });

    it("hides the join buttons from a signed-in invitee", async () => {
      mocks.auth = { isAuthenticated: true, isLoading: false, user: { email: "alex@example.com" } };
      mocks.getInviteDetails.mockResolvedValue(inviteDetails(closed));
      await renderPage();
      expect(screen.getByRole("heading", { name: "This exchange has closed" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Join Exchange/ })).toBeNull();
    });

    it("still reads sensibly without a reason", async () => {
      mocks.getInviteDetails.mockResolvedValue(inviteDetails({ join_open: false, closed_reason: null }));
      await renderPage();
      expect(screen.getByText("This exchange is no longer accepting new people.")).toBeTruthy();
    });

    it("takes priority over a declined invitation", async () => {
      const participant = { name: "Alex", email: "alex@example.com", status: "declined" as const };
      mocks.getInviteDetails.mockResolvedValue(inviteDetails({ ...closed, participant }));
      await renderPage();
      expect(screen.getByRole("heading", { name: "This exchange has closed" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Invitation Declined" })).toBeNull();
    });

    it("keeps Already Joined for someone who accepted", async () => {
      const participant = { name: "Alex", email: "alex@example.com", status: "accepted" as const };
      mocks.getInviteDetails.mockResolvedValue(inviteDetails({ ...closed, participant }));
      await renderPage();
      expect(screen.getByRole("heading", { name: "Already Joined!" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "This exchange has closed" })).toBeNull();
    });
  });

  it("treats an API response without join_open as open", async () => {
    mocks.getInviteDetails.mockResolvedValue({ ...inviteDetails(), join_open: undefined, closed_reason: undefined });
    await renderPage();
    expect(screen.getByText("You Are Invited!")).toBeTruthy();
  });

  describe("when signed in", () => {
    it("warns when the invite went to a different email but still allows joining", async () => {
      mocks.auth = { isAuthenticated: true, isLoading: false, user: { email: "kent@example.com" } };
      await renderPage();
      expect(screen.getByText("This invite was sent to alex@example.com. You're signed in as kent@example.com.")).toBeTruthy();
      const join = screen.getByRole("button", { name: /Join Exchange/ }) as HTMLButtonElement;
      expect(join.disabled).toBe(false);
    });

    it("stays quiet when the emails match apart from case", async () => {
      mocks.auth = { isAuthenticated: true, isLoading: false, user: { email: "Alex@Example.com" } };
      await renderPage();
      expect(screen.queryByText(/This invite was sent to/)).toBeNull();
    });

    it("shows no notice to a logged-out person", async () => {
      await renderPage();
      expect(screen.queryByText(/This invite was sent to/)).toBeNull();
    });
  });
});
