import type { ExchangeExclusion, ExchangeParticipant, GiftExchange } from "@niftygifty/types";
import {
  canManageExchangeWishlist,
  buildCreateExchangeExclusionPayload,
  buildCreateExchangeParticipantPayload,
  buildCreateExchangePayload,
  buildExchangeSections,
  buildExchangeInviteUrl,
  canStartExchange,
  getExchangeStartBlocker,
  getExchangeWishlistSubtitle,
  hasExchangeExclusionBetween,
} from "@/lib/models";

function buildExchange(overrides: Partial<GiftExchange> = {}): GiftExchange {
  return {
    id: overrides.id || 1,
    name: overrides.name || "Family Exchange",
    exchange_date: overrides.exchange_date ?? "2026-12-25",
    status: overrides.status || "draft",
    budget_min: overrides.budget_min ?? null,
    budget_max: overrides.budget_max ?? null,
    user_id: overrides.user_id || 1,
    is_owner: overrides.is_owner ?? true,
    participant_count: overrides.participant_count || 0,
    accepted_count: overrides.accepted_count || 0,
    can_start: overrides.can_start ?? false,
    my_participant: overrides.my_participant ?? null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildParticipant(overrides: Partial<ExchangeParticipant> = {}): ExchangeParticipant {
  return {
    id: overrides.id || 10,
    gift_exchange_id: overrides.gift_exchange_id || 1,
    user_id: overrides.user_id ?? 2,
    name: overrides.name || "Alex Parker",
    email: overrides.email || "alex@example.com",
    status: overrides.status || "accepted",
    display_name: overrides.display_name || "Alex Parker",
    has_user: overrides.has_user ?? true,
    wishlist_count: overrides.wishlist_count ?? 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildExclusion(overrides: Partial<ExchangeExclusion> = {}): ExchangeExclusion {
  return {
    id: overrides.id || 20,
    gift_exchange_id: overrides.gift_exchange_id || 1,
    participant_a_id: overrides.participant_a_id || 10,
    participant_b_id: overrides.participant_b_id || 11,
    participant_a: overrides.participant_a || { id: 10, name: "Alex Parker" },
    participant_b: overrides.participant_b || { id: 11, name: "Sam Lee" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("exchange model helpers", () => {
  it("groups owned and participating exchanges", () => {
    const sections = buildExchangeSections([
      buildExchange({ id: 1, is_owner: true }),
      buildExchange({ id: 2, is_owner: false }),
    ]);

    expect(sections).toEqual([
      { key: "owned", title: "My Exchanges", data: [expect.objectContaining({ id: 1 })] },
      {
        key: "participating",
        title: "Participating In",
        data: [expect.objectContaining({ id: 2 })],
      },
    ]);
  });

  it("builds a trimmed create payload with optional budgets", () => {
    expect(
      buildCreateExchangePayload({
        name: "  Family Christmas  ",
        exchangeDate: "2026-12-24",
        budgetMin: " 25 ",
        budgetMax: " 50.50 ",
      })
    ).toEqual({
      name: "Family Christmas",
      exchange_date: "2026-12-24",
      budget_min: 25,
      budget_max: 50.5,
    });
  });

  it("omits blank optional create fields", () => {
    expect(
      buildCreateExchangePayload({
        name: "Team Swap",
        exchangeDate: "",
        budgetMin: "",
        budgetMax: "",
      })
    ).toEqual({
      name: "Team Swap",
      exchange_date: undefined,
      budget_min: undefined,
      budget_max: undefined,
    });
  });

  it("builds a trimmed participant invite payload", () => {
    expect(
      buildCreateExchangeParticipantPayload({
        name: "  Alex Parker  ",
        email: "  alex@example.com  ",
      })
    ).toEqual({
      name: "Alex Parker",
      email: "alex@example.com",
    });
  });

  it("builds an exclusion payload", () => {
    expect(
      buildCreateExchangeExclusionPayload({
        participantAId: 10,
        participantBId: 11,
      })
    ).toEqual({
      participant_a_id: 10,
      participant_b_id: 11,
    });
  });

  it("detects existing exclusion rules in either direction", () => {
    const exclusions = [buildExclusion({ participant_a_id: 10, participant_b_id: 11 })];

    expect(hasExchangeExclusionBetween(exclusions, 10, 11)).toBe(true);
    expect(hasExchangeExclusionBetween(exclusions, 11, 10)).toBe(true);
    expect(hasExchangeExclusionBetween(exclusions, 10, 12)).toBe(false);
  });

  it("builds a public exchange invite URL", () => {
    expect(buildExchangeInviteUrl(" invite token ")).toBe(
      "https://listygifty.com/join/exchange/invite%20token"
    );
  });

  it("shows the start action only for ready owned exchanges", () => {
    expect(canStartExchange(buildExchange({ is_owner: true, can_start: true }))).toBe(true);
    expect(canStartExchange(buildExchange({ is_owner: false, can_start: true }))).toBe(false);
    expect(canStartExchange(buildExchange({ is_owner: true, can_start: false }))).toBe(false);
    expect(
      canStartExchange(buildExchange({ is_owner: true, can_start: true, status: "active" }))
    ).toBe(false);
  });

  it("allows accepted participants to manage wishlists before matches are drawn", () => {
    expect(
      canManageExchangeWishlist(
        buildExchange({
          status: "inviting",
          my_participant: buildParticipant({ wishlist_count: 2 }),
        })
      )
    ).toBe(true);

    expect(
      canManageExchangeWishlist(
        buildExchange({
          status: "inviting",
          my_participant: buildParticipant({ status: "invited" }),
        })
      )
    ).toBe(false);
  });

  it("explains when wishlist items should be added", () => {
    const exchange = buildExchange({
      status: "inviting",
      my_participant: buildParticipant({ wishlist_count: 1 }),
    });

    expect(getExchangeWishlistSubtitle(exchange)).toBe("1 item before matches are drawn");
    expect(getExchangeWishlistSubtitle({ ...exchange, status: "active" })).toBe("1 item");
  });

  it("explains why an owner cannot draw matches yet", () => {
    expect(
      getExchangeStartBlocker(
        buildExchange({
          status: "draft",
          participant_count: 0,
          accepted_count: 0,
          can_start: false,
        })
      )
    ).toBe("Add at least 3 participants to send invites before drawing matches.");

    expect(
      getExchangeStartBlocker(
        buildExchange({
          status: "inviting",
          participant_count: 2,
          accepted_count: 2,
          can_start: false,
        })
      )
    ).toBe("Add 1 more participant before drawing matches.");

    expect(
      getExchangeStartBlocker(
        buildExchange({
          status: "inviting",
          participant_count: 4,
          accepted_count: 2,
          can_start: false,
        })
      )
    ).toBe("2 participants still need to accept.");

    expect(
      getExchangeStartBlocker(
        buildExchange({
          is_owner: true,
          status: "inviting",
          participant_count: 3,
          accepted_count: 3,
          can_start: true,
        })
      )
    ).toBeNull();
  });
});
