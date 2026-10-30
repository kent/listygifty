import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ExchangeExclusion,
  ExchangeParticipant,
  GiftExchangeWithParticipants,
} from "@niftygifty/types";
import ExchangeDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getBySlug: vi.fn(),
  createParticipant: vi.fn(),
  deleteParticipant: vi.fn(),
  resendInvite: vi.fn(),
  getExclusions: vi.fn(),
  getNotifications: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login" },
  giftExchangesService: { getBySlug: mocks.getBySlug },
  exchangeParticipantsService: {
    create: mocks.createParticipant,
    delete: mocks.deleteParticipant,
    resendInvite: mocks.resendInvite,
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

beforeEach(() => {
  mocks.push.mockReset();
  mocks.getBySlug.mockReset();
  mocks.createParticipant.mockReset();
  mocks.deleteParticipant.mockReset().mockResolvedValue(undefined);
  mocks.resendInvite.mockReset().mockResolvedValue({ message: "Invitation resent" });
  mocks.getExclusions.mockReset().mockResolvedValue([]);
  mocks.getNotifications.mockReset().mockResolvedValue([]);
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
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
  it("shows the new status and Publish after adding someone", async () => {
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
    expect(screen.queryByRole("button", { name: "Publish Exchange" })).toBeNull();

    await addPerson("Bea");

    expect(await screen.findByText("inviting")).toBeTruthy();
    expect(screen.queryByText("draft")).toBeNull();
    expect(screen.getByRole("button", { name: "Publish Exchange" })).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "Publish Exchange" })).toBeTruthy();

    const row = screen.getByText("ana@example.com").closest(".rounded-lg") as HTMLElement;
    fireEvent.click(row.querySelector("button:last-of-type") as HTMLElement);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Publish Exchange" })).toBeNull()
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

    const row = screen.getByText("ana@example.com").closest(".rounded-lg") as HTMLElement;
    fireEvent.click(row.querySelector("button:last-of-type") as HTMLElement);

    await waitFor(() => expect(screen.queryByText("ana@example.com")).toBeNull());
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.getAllByText("Kent").length).toBe(2);
  });

  it("refreshes after resending an invite", async () => {
    const pending = person(2, "Ana");
    mocks.getBySlug.mockResolvedValue(
      exchangeWith({ status: "inviting", exchange_participants: [organizer, pending] })
    );

    await renderPage();
    fireEvent.click(screen.getByTitle("Resend invite"));

    await waitFor(() => expect(mocks.resendInvite).toHaveBeenCalledWith(7, 2));
    await waitFor(() => expect(mocks.getBySlug).toHaveBeenCalledTimes(2));
  });
});
