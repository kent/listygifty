import { describe, expect, it } from "vitest";
import type { GiftExchange } from "@niftygifty/types";
import { exchangeNextStep, upcomingExchanges } from "./exchange-next-step";

const exchange = (overrides: Partial<GiftExchange> = {}) =>
  ({
    slug: "family",
    status: "inviting",
    is_owner: true,
    accepted_count: 2,
    participant_count: 4,
    exchange_date: "2026-12-25",
    capabilities: { publish: false, view_match: false },
    ...overrides,
  }) as GiftExchange;

describe("exchangeNextStep", () => {
  it("sends someone with a match straight to it", () => {
    const step = exchangeNextStep(exchange({ status: "active", capabilities: { view_match: true } as GiftExchange["capabilities"] }));
    expect(step).toEqual({ text: "Names are drawn. See who you're buying for.", href: "/exchanges/family/my-match" });
  });

  it("tells an organizer who isn't in the draw that it's done", () => {
    expect(exchangeNextStep(exchange({ status: "active" }))).toEqual({ text: "Names are drawn.", href: "/exchanges/family" });
  });

  it("prompts the organizer once names can be drawn", () => {
    const step = exchangeNextStep(exchange({ capabilities: { publish: true } as GiftExchange["capabilities"] }));
    expect(step.text).toBe("2 of 4 joined. Draw names when you're ready.");
  });

  it("tells the organizer when it's too early to draw", () => {
    expect(exchangeNextStep(exchange({ accepted_count: 1 })).text).toBe("1 of 4 joined. Waiting for more people.");
  });

  it("tells a participant what they're waiting for", () => {
    expect(exchangeNextStep(exchange({ is_owner: false })).text).toBe("2 of 4 joined. Waiting for names to be drawn.");
  });
});

describe("upcomingExchanges", () => {
  const today = new Date(2026, 9, 31);

  it("keeps exchanges still to come and those with no date", () => {
    const list = [exchange(), exchange({ slug: "nodate", exchange_date: null })];
    expect(upcomingExchanges(list, today).map((item) => item.slug)).toEqual(["family", "nodate"]);
  });

  it("drops finished and past exchanges", () => {
    const list = [exchange({ status: "completed" }), exchange({ exchange_date: "2026-10-01" })];
    expect(upcomingExchanges(list, today)).toEqual([]);
  });
});
