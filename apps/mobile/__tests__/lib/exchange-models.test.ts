import type { GiftExchange } from "@niftygifty/types";
import {
  buildCreateExchangeParticipantPayload,
  buildCreateExchangePayload,
  buildExchangeSections,
  canStartExchange,
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

  it("shows the start action only for ready owned exchanges", () => {
    expect(canStartExchange(buildExchange({ is_owner: true, can_start: true }))).toBe(true);
    expect(canStartExchange(buildExchange({ is_owner: false, can_start: true }))).toBe(false);
    expect(canStartExchange(buildExchange({ is_owner: true, can_start: false }))).toBe(false);
    expect(
      canStartExchange(buildExchange({ is_owner: true, can_start: true, status: "active" }))
    ).toBe(false);
  });
});
