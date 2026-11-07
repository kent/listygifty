import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ExchangeExclusion,
  ExchangeParticipant,
  GiftExchangeWithParticipants,
} from "@niftygifty/types";
import { ApiError } from "@/lib/api-client";
import ExchangeDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getBySlug: vi.fn(),
  createParticipant: vi.fn(),
  deleteParticipant: vi.fn(),
  resendInvite: vi.fn(),
  nudge: vi.fn(),
  getExclusions: vi.fn(),
  getNotifications: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError, warning: mocks.toastWarning },
}));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  giftExchangesService: { getBySlug: mocks.getBySlug },
  exchangeParticipantsService: {
    create: mocks.createParticipant,
    delete: mocks.deleteParticipant,
    resendInvite: mocks.resendInvite,
    nudge: mocks.nudge,
  },
  exchangeExclusionsService: { getAll: mocks.getExclusions },
  exchangeNotificationsService: { getAll: mocks.getNotifications },
}));

const timestamps = { created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };

function person(
  id: number,
  name: string,
  overrides: Partial<ExchangeParticipant> = {}
): ExchangeParticipant {
  return {
    ...timestamps,
    id,
    gift_exchange_id: 7,
    user_id: null,
    name,
    email: `${name.toLowerCase()}@example.com`,
    status: "invited",
    display_name: name,
    has_user: false,
    wishlist_count: 0,
    invite_token: `invite-${id}`,
    ...overrides,
  };
}

const organizer = person(1, "Kent", { user_id: 100, status: "accepted", has_user: true });

function exchangeWith(
  overrides: Partial<GiftExchangeWithParticipants> = {}
): GiftExchangeWithParticipants {
  const participants = overrides.exchange_participants ?? [organizer];
  return {
    ...timestamps,
    id: 7,
    name: "Family Christmas",
    slug: "family-christmas",
    exchange_date: null,
    status: "draft",
    budget_min: null,
    budget_max: null,
    user_id: 100,
    is_owner: true,
    participant_count: participants.length,
    accepted_count: participants.filter((p) => p.status === "accepted").length,
    published_at: null,
    can_publish: false,
    can_start: false,
    role: "organizer",
    roles: ["owner", "organizer", "participant"],
    capabilities: {
      organize: true,
      participate: true,
      view_match: false,
      nudge_match: false,
      publish: false,
      redo: false,
      delete: true,
    },
    my_participant: organizer,
    share_url: "https://listygifty.test/e/family-christmas/share",
    ...overrides,
    exchange_participants: participants,
  };
}

function rule(id: number, a: ExchangeParticipant, b: ExchangeParticipant): ExchangeExclusion {
  return {
    ...timestamps,
    id,
    gift_exchange_id: 7,
    participant_a_id: a.id,
    participant_b_id: b.id,
    participant_a: { id: a.id, name: a.name },
    participant_b: { id: b.id, name: b.name },
  };
}

async function renderPage() {
  const params = Promise.resolve({ id: "family-christmas" });
  // use(params) suspends, and React only retries inside an awaited act.
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ExchangeDetailPage params={params} />
      </Suspense>
    );
  });
  await screen.findByRole("heading", { name: "Family Christmas" });
}

async function addPerson(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
    target: { value: `${name.toLowerCase()}@example.com` },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add & Invite" }));
}

async function removePerson(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Remove ${name}` }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.getBySlug.mockReset();
  mocks.createParticipant.mockReset();
  mocks.deleteParticipant.mockReset().mockResolvedValue(undefined);
  mocks.resendInvite.mockReset().mockResolvedValue({ message: "Invitation resent" });
  mocks.nudge.mockReset();
  mocks.getExclusions.mockReset().mockResolvedValue([]);
  mocks.getNotifications.mockReset().mockResolvedValue([]);
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.toastWarning.mockReset();
});

describe("the wishlist card", () => {
  const ana = person(2, "Ana", { user_id: 200, status: "accepted", has_user: true });

  function wishlistLink() {
    return screen.queryByRole("link", { name: "Edit Wishlist" });
  }

  it.each(["draft", "inviting", "active", "completed"] as const)(
    "links a joined participant to their wishlist while %s",
    async (status) => {
      mocks.getBySlug.mockResolvedValue(
        exchangeWith({ status, is_owner: false, my_participant: ana, share_url: null })
      );

      await renderPage();

      expect(wishlistLink()?.getAttribute("href")).toBe("/exchanges/family-christmas/my-wishlist");
    }
  );

  it.each(["draft", "inviting", "active", "completed"] as const)(
    "links an organizer who joined to their wishlist while %s",
    async (status) => {
      mocks.getBySlug.mockResolvedValue(exchangeWith({ status }));

      await renderPage();

      expect(wishlistLink()?.getAttribute("href")).toBe("/exchanges/family-christmas/my-wishlist");
    }
  );

  it("is hidden from an organizer who isn't taking part", async () => {
    mocks.getBySlug.mockResolvedValue(exchangeWith({ my_participant: null }));

    await renderPage();

    expect(wishlistLink()).toBeNull();
  });

  it("is hidden from someone who hasn't joined", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ is_owner: false, my_participant: person(2, "Ana", { status: "invited" }) })
    );

    await renderPage();

    expect(wishlistLink()).toBeNull();
  });

  it("counts a single item in the singular", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ my_participant: { ...organizer, wishlist_count: 1 } })
    );

    await renderPage();

    expect(screen.getByText("1 item")).toBeTruthy();
  });
});

describe("when the exchange can't be loaded", () => {
  async function renderFailingPage() {
    const params = Promise.resolve({ id: "family-christmas" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <ExchangeDetailPage params={params} />
        </Suspense>
      );
    });
  }

  it("says not found only for a 404", async () => {
    mocks.getBySlug.mockRejectedValue(new ApiError(404, { error: "Gift exchange not found" }));

    await renderFailingPage();

    expect(screen.getByText("Exchange not found")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Exchanges" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it.each<[string, Error]>([
    ["the network is down", new ApiError(0, { error: "Request timeout after 30000ms" })],
    ["the server fails", new ApiError(503, undefined)],
    ["fetch itself fails", new TypeError("Failed to fetch")],
  ])("offers Try again when %s", async (_, failure) => {
    mocks.getBySlug.mockRejectedValue(failure);

    await renderFailingPage();

    expect(screen.queryByText("Exchange not found")).toBeNull();
    expect(screen.getByText("We couldn't load this exchange. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Exchanges" })).toBeTruthy();
  });

  it("loads the exchange again from Try again", async () => {
    mocks.getBySlug
      .mockRejectedValueOnce(new ApiError(503, undefined))
      .mockResolvedValueOnce(exchangeWith());

    await renderFailingPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });

    expect(mocks.getBySlug).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: "Family Christmas" })).toBeTruthy();
    expect(screen.queryByText(/couldn't load this exchange/)).toBeNull();
  });

  it("says not found if the retry comes back with a 404", async () => {
    mocks.getBySlug
      .mockRejectedValueOnce(new ApiError(503, undefined))
      .mockRejectedValueOnce(new ApiError(404, { error: "Gift exchange not found" }));

    await renderFailingPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });

    expect(screen.getByText("Exchange not found")).toBeTruthy();
    expect(screen.queryByText(/couldn't load this exchange/)).toBeNull();
  });
});

describe("when someone can't be added", () => {
  it("says why, and keeps what was typed so it can be fixed", async () => {
    mocks.getBySlug.mockResolvedValue(exchangeWith());
    mocks.createParticipant.mockRejectedValue(
      new ApiError(422, { errors: ["Email is already a participant"] })
    );

    await renderPage();
    await addPerson("Bea");

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Email is already a participant")
    );
    const email = screen.getByPlaceholderText("john@example.com") as HTMLInputElement;
    expect(email.value).toBe("bea@example.com");
  });

  it("doesn't print raw server errors", async () => {
    mocks.getBySlug.mockResolvedValue(exchangeWith());
    mocks.createParticipant.mockRejectedValue(new ApiError(500, { error: "PG::Error" }));

    await renderPage();
    await addPerson("Bea");

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("The server hit a snag. Try again in a moment.")
    );
  });
});

describe("the next step line", () => {
  it("shows the organizer what's needed, and updates after a change", async () => {
    mocks.getBySlug
      .mockResolvedValueOnce(exchangeWith({ status: "draft" }))
      .mockResolvedValueOnce(
        exchangeWith({
          status: "inviting",
          exchange_participants: [organizer, person(2, "Ana", { status: "accepted" }), person(3, "Bea")],
        })
      );
    mocks.createParticipant.mockResolvedValue(person(3, "Bea"));

    await renderPage();
    expect(screen.getByTestId("exchange-next-step").textContent).toBe(
      "You need at least 2 people to draw names. 1 joined so far."
    );

    await addPerson("Bea");

    await waitFor(() =>
      expect(screen.getByTestId("exchange-next-step").textContent).toBe(
        "Ready when you are. 1 person hasn't joined yet, and anyone who hasn't joined when you draw is left out."
      )
    );
  });

  it("is gone once names are drawn", async () => {
    mocks.getBySlug.mockResolvedValue(exchangeWith({ status: "active" }));

    await renderPage();

    expect(screen.queryByTestId("exchange-next-step")).toBeNull();
  });
});

describe("keeping the exchange current after roster changes", () => {
  it("shows the new status and Draw names after adding someone", async () => {
    const newcomer = person(3, "Bea");
    mocks.getBySlug
      .mockResolvedValueOnce(exchangeWith({ status: "draft" }))
      .mockResolvedValueOnce(
        exchangeWith({
          status: "inviting",
          can_start: true,
          exchange_participants: [organizer, person(2, "Ana", { status: "accepted" }), newcomer],
        })
      );
    mocks.createParticipant.mockResolvedValue(newcomer);

    await renderPage();
    expect(screen.getByText("draft")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Draw names" })).toBeNull();

    await addPerson("Bea");

    expect(await screen.findByText("inviting")).toBeTruthy();
    expect(screen.queryByText("draft")).toBeNull();
    expect(screen.getByRole("button", { name: "Draw names" })).toBeTruthy();
    expect(screen.getByText("2/3 joined")).toBeTruthy();
  });

  it("keeps the new person on screen when the refresh fails", async () => {
    const newcomer = person(3, "Bea");
    mocks.getBySlug
      .mockResolvedValueOnce(exchangeWith())
      .mockRejectedValueOnce(new Error("offline"));
    mocks.createParticipant.mockResolvedValue(newcomer);

    await renderPage();
    await addPerson("Bea");

    expect(await screen.findByText("bea@example.com")).toBeTruthy();
    await waitFor(() => expect(mocks.getBySlug).toHaveBeenCalledTimes(2));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Invited Bea");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("refreshes after removing someone", async () => {
    const ana = person(2, "Ana", { status: "accepted" });
    mocks.getBySlug
      .mockResolvedValueOnce(
        exchangeWith({ status: "inviting", can_start: true, exchange_participants: [organizer, ana] })
      )
      .mockResolvedValueOnce(exchangeWith({ status: "inviting", exchange_participants: [organizer] }));

    await renderPage();
    expect(screen.getByRole("button", { name: "Draw names" })).toBeTruthy();

    await removePerson("Ana");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Draw names" })).toBeNull()
    );
    expect(screen.getByText("1/1 joined")).toBeTruthy();
  });

  it("drops the rules of a removed person, as the API does", async () => {
    const ana = person(2, "Ana", { status: "accepted" });
    const bea = person(3, "Bea", { status: "accepted" });
    mocks.getBySlug
      .mockResolvedValueOnce(
        exchangeWith({ status: "inviting", exchange_participants: [organizer, ana, bea] })
      )
      .mockResolvedValueOnce(
        exchangeWith({ status: "inviting", exchange_participants: [organizer, bea] })
      );
    mocks.getExclusions.mockResolvedValue([rule(50, ana, bea), rule(51, organizer, bea)]);

    await renderPage();
    await screen.findAllByText("Ana");

    await removePerson("Ana");

    await waitFor(() => expect(screen.queryByText("ana@example.com")).toBeNull());
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.getAllByText("Kent").length).toBe(2);
  });

  it("refreshes after resending an invite", async () => {
    const pending = person(2, "Ana", { status: "declined" });
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ status: "inviting", exchange_participants: [organizer, pending] })
    );

    await renderPage();
    fireEvent.click(screen.getByTitle("Resend invite"));

    await waitFor(() => expect(mocks.resendInvite).toHaveBeenCalledWith(7, 2));
    await waitFor(() => expect(mocks.getBySlug).toHaveBeenCalledTimes(2));
  });
});

describe("confirming before removing someone", () => {
  const ana = person(2, "Ana", { status: "accepted" });

  beforeEach(() => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ status: "inviting", exchange_participants: [organizer, ana] })
    );
  });

  it("asks first and says what they lose", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Remove Ana" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Remove Ana from Family Christmas?" })
    ).toBeTruthy();
    expect(dialog.textContent).toContain("wishlist");
    expect(dialog.textContent).toContain("exclusion rules");
    expect(mocks.deleteParticipant).not.toHaveBeenCalled();
  });

  it("keeps them when the organizer backs out", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Remove Ana" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep them" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.deleteParticipant).not.toHaveBeenCalled();
    expect(screen.getByText("ana@example.com")).toBeTruthy();
  });

  it("removes them once confirmed", async () => {
    await renderPage();

    await removePerson("Ana");

    await waitFor(() => expect(mocks.deleteParticipant).toHaveBeenCalledWith(7, 2));
    expect(mocks.deleteParticipant).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Removed Ana");
  });

  it("reports a failed removal and keeps them on the roster", async () => {
    mocks.deleteParticipant.mockRejectedValue(new Error("nope"));
    await renderPage();

    await removePerson("Ana");

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Failed to remove participant"));
    expect(screen.getByText("ana@example.com")).toBeTruthy();
  });
});

describe("loading exclusion rules", () => {
  it("fetches them for the organizer", async () => {
    mocks.getBySlug.mockResolvedValue(exchangeWith());

    await renderPage();

    expect(mocks.getExclusions).toHaveBeenCalledWith(7);
  });

  it("skips them for a participant, who would only get a 404", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({
        is_owner: false,
        my_participant: person(2, "Ana", { user_id: 200, status: "accepted" }),
        share_url: null,
      })
    );

    await renderPage();

    expect(mocks.getExclusions).not.toHaveBeenCalled();
    expect(mocks.getNotifications).toHaveBeenCalledWith(7);
  });
});

describe("the publish dialog", () => {
  const ana = person(2, "Ana", { status: "accepted" });
  const bea = person(3, "Bea");

  async function openPublishDialog() {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Draw names" }));
    return screen.findByRole("dialog");
  }

  it("is honest that the draw can be redone", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ status: "inviting", can_start: true, exchange_participants: [organizer, ana] })
    );

    const dialog = await openPublishDialog();

    expect(dialog.textContent).toContain(
      "You can redo the draw later, but everyone will get a new match and a new email."
    );
    expect(dialog.textContent).not.toContain("cannot be undone");
  });

  it("uses the singular for one of each", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({
        status: "inviting",
        can_start: true,
        accepted_count: 1,
        exchange_participants: [organizer, bea],
      })
    );
    mocks.getExclusions.mockResolvedValue([rule(50, organizer, bea)]);

    const dialog = await openPublishDialog();

    expect(within(dialog).getByText(/^• 1 joined participant$/)).toBeTruthy();
    expect(within(dialog).getByText(/^• 1 pending invitation will close$/)).toBeTruthy();
    expect(within(dialog).getByText(/^• 1 exclusion rule$/)).toBeTruthy();
  });

  it("uses the plural otherwise", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({
        status: "inviting",
        can_start: true,
        exchange_participants: [organizer, ana, bea, person(4, "Cy")],
      })
    );
    mocks.getExclusions.mockResolvedValue([rule(50, organizer, ana), rule(51, ana, bea)]);

    const dialog = await openPublishDialog();

    expect(within(dialog).getByText(/^• 2 joined participants$/)).toBeTruthy();
    expect(within(dialog).getByText(/^• 2 pending invitations will close$/)).toBeTruthy();
    expect(within(dialog).getByText(/^• 2 exclusion rules$/)).toBeTruthy();
  });

  it("doesn't count someone who declined as a pending invitation", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({
        status: "inviting",
        can_start: true,
        exchange_participants: [organizer, ana, bea, person(4, "Cy", { status: "declined" })],
      })
    );

    const dialog = await openPublishDialog();

    expect(within(dialog).getByText(/^• 1 pending invitation will close$/)).toBeTruthy();
  });
});

describe("icon buttons in the roster", () => {
  const ana = person(2, "Ana", { can_nudge: true });
  const bea = person(3, "Bea", { status: "accepted" });

  beforeEach(() => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ status: "inviting", exchange_participants: [organizer, ana, bea] })
    );
    mocks.getExclusions.mockResolvedValue([rule(50, organizer, bea)]);
  });

  it("says who each one acts on", async () => {
    await renderPage();
    await screen.findByText("bea@example.com");

    for (const name of [
      "Copy invite for Ana",
      "Nudge Ana",
      "Remove Ana",
      "Remove Bea",
      "Remove rule between Kent and Bea",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("leaves no button on the page without a name", async () => {
    await renderPage();
    await screen.findByRole("button", { name: "Remove rule between Kent and Bea" });

    const nameless = screen
      .getAllByRole("button")
      .filter((button) => !button.textContent?.trim() && !button.getAttribute("aria-label"));

    expect(nameless).toEqual([]);
  });
});

describe("coming back to the exchange page", () => {
  it("picks up people who joined while the tab was in the background", async () => {
    const joined = person(201, "Parker", { status: "accepted" });
    mocks.getBySlug
      .mockResolvedValueOnce(exchangeWith())
      .mockResolvedValue(exchangeWith({ exchange_participants: [organizer, joined] }));
    await renderPage();
    const calls = mocks.getBySlug.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(mocks.getBySlug.mock.calls.length).toBeGreaterThan(calls));
    expect(await screen.findByText("2/2 joined")).toBeTruthy();
  });
});

describe("a page left open while people join", () => {
  it("updates by itself until names are drawn", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const joined = person(201, "Parker", { status: "accepted" });
      mocks.getBySlug
        .mockResolvedValueOnce(exchangeWith({ status: "inviting" }))
        .mockResolvedValue(exchangeWith({ status: "inviting", exchange_participants: [organizer, joined] }));
      await renderPage();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });

      expect(await screen.findByText("2/2 joined")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("someone who declined", () => {
  it("can be invited again", async () => {
    const declined = { ...person(201, "Parker"), status: "declined" as const };
    mocks.getBySlug.mockResolvedValue(exchangeWith({ exchange_participants: [organizer, declined] }));
    await renderPage();

    expect(await screen.findByRole("button", { name: /Resend invite to Parker/ })).toBeTruthy();
  });
});

describe("nudging someone who hasn't joined", () => {
  const ana = person(2, "Ana", { can_nudge: true });

  // Radix's checkbox measures itself, and jsdom has no ResizeObserver.
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  beforeEach(() => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ status: "inviting", exchange_participants: [organizer, ana] })
    );
  });

  async function openNudge() {
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Nudge Ana" }));
    return screen.findByRole("dialog");
  }

  it("emails and texts them, and remembers the number", async () => {
    mocks.nudge.mockResolvedValue({
      participant: { ...ana, phone: "+12893797875", can_nudge: false, last_nudged_at: "2026-11-07T15:00:00Z" },
      emailed: true,
      text: "sent",
      text_error: null,
    });
    const dialog = await openNudge();

    expect((within(dialog).getByLabelText("Email") as HTMLInputElement).value).toBe("ana@example.com");
    fireEvent.change(within(dialog).getByLabelText(/Mobile number/), { target: { value: "289 379 7875" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Ana said it's OK to text them about this exchange." }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Send nudge" }));

    await waitFor(() =>
      expect(mocks.nudge).toHaveBeenCalledWith(7, 2, {
        email: "ana@example.com",
        phone: "289 379 7875",
        text_consent: true,
      })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Nudged Ana by email and text");
    expect(await screen.findByText("(289) 379-7875")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nudged Ana in the last day" })).toHaveProperty("disabled", true);
  });

  it("says so when the email went but the text didn't", async () => {
    mocks.nudge.mockResolvedValue({
      participant: { ...ana, can_nudge: false },
      emailed: true,
      text: "failed",
      text_error: "That number can't get texts. It may be a landline.",
    });
    const dialog = await openNudge();

    fireEvent.change(within(dialog).getByLabelText(/Mobile number/), { target: { value: "4165550100" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /said it's OK to text them/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Send nudge" }));

    await waitFor(() =>
      expect(mocks.toastWarning).toHaveBeenCalledWith(
        "Emailed Ana, but the text didn't go through. That number can't get texts. It may be a landline."
      )
    );
  });

  it("won't text until the organizer confirms it's OK", async () => {
    const dialog = await openNudge();

    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/Mobile number/), { target: { value: "4165550100" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send nudge" }));

    expect(
      await within(dialog).findByText("Check this box to text them, or clear the number to just email them.")
    ).toBeTruthy();
    expect(mocks.nudge).not.toHaveBeenCalled();
  });

  it("remembers that they said texts are OK", async () => {
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({
        status: "inviting",
        exchange_participants: [
          organizer,
          { ...ana, phone: "+12893797875", text_consent_at: "2026-11-07T15:00:00Z" },
        ],
      })
    );
    mocks.nudge.mockResolvedValue({ participant: { ...ana, can_nudge: false }, emailed: true, text: "sent", text_error: null });
    const dialog = await openNudge();

    expect(within(dialog).getByRole("checkbox")).toHaveProperty("ariaChecked", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send nudge" }));

    await waitFor(() =>
      expect(mocks.nudge).toHaveBeenCalledWith(7, 2, {
        email: "ana@example.com",
        phone: "(289) 379-7875",
        text_consent: true,
      })
    );
  });

  it("shows the API's reason when the nudge is refused", async () => {
    mocks.nudge.mockRejectedValue(
      new ApiError(422, { error: "You already nudged Ana today. You can nudge them again tomorrow." })
    );
    const dialog = await openNudge();

    fireEvent.click(within(dialog).getByRole("button", { name: "Send nudge" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("You already nudged Ana today. You can nudge them again tomorrow.")
    );
  });
});
