import { describe, expect, it } from "vitest";
import type { ExchangeParticipant, ExchangeStatus } from "@niftygifty/types";
import { getExchangeNextStep, type NextStepExchange } from "./exchange-next-step";

function person(status: ExchangeParticipant["status"], userId: number | null = null) {
  return { status, user_id: userId, display_name: `Person ${userId}` };
}

const joined = (count: number) => Array.from({ length: count }, () => person("accepted"));
const pending = (count: number) => Array.from({ length: count }, () => person("invited"));

function ownerView(
  roster: NextStepExchange["exchange_participants"],
  status: ExchangeStatus = "inviting"
): NextStepExchange {
  return {
    status,
    is_owner: true,
    user_id: 100,
    accepted_count: roster.filter((p) => p.status === "accepted").length,
    exchange_participants: roster,
    my_participant: null,
  };
}

function participantView(
  overrides: Partial<NextStepExchange> = {}
): NextStepExchange {
  return {
    status: "inviting",
    is_owner: false,
    user_id: 100,
    accepted_count: 2,
    exchange_participants: [],
    my_participant: { status: "accepted" },
    ...overrides,
  };
}

describe("getExchangeNextStep for the organizer", () => {
  it("asks for more people below two joined", () => {
    expect(getExchangeNextStep(ownerView(joined(1), "draft"))).toBe(
      "You need at least 2 people to draw names. 1 joined so far."
    );
    expect(getExchangeNextStep(ownerView([...joined(0), ...pending(3)]))).toBe(
      "You need at least 2 people to draw names. 0 joined so far."
    );
  });

  it("warns that people who haven't joined are left out", () => {
    expect(getExchangeNextStep(ownerView([...joined(2), ...pending(3)]))).toBe(
      "Ready when you are. 3 people haven't joined yet, and anyone who hasn't joined when you draw is left out."
    );
  });

  it("uses the singular for one pending person", () => {
    expect(getExchangeNextStep(ownerView([...joined(2), ...pending(1)]))).toBe(
      "Ready when you are. 1 person hasn't joined yet, and anyone who hasn't joined when you draw is left out."
    );
  });

  it("says everyone's in when nobody is pending", () => {
    expect(getExchangeNextStep(ownerView(joined(4)))).toBe(
      "Everyone's in. Draw names when you're ready."
    );
  });

  it("does not count someone who declined as pending", () => {
    expect(getExchangeNextStep(ownerView([...joined(2), person("declined")]))).toBe(
      "Everyone's in. Draw names when you're ready."
    );
  });
});

describe("getExchangeNextStep for a participant", () => {
  it("names the organizer when they are on the roster", () => {
    const roster = [person("accepted", 100), person("accepted", 200)];
    roster[0].display_name = "Kent";
    expect(getExchangeNextStep(participantView({ exchange_participants: roster }))).toBe(
      "You're in. Waiting for Kent to draw names."
    );
  });

  it("falls back to the organizer when they aren't on the roster", () => {
    const roster = [person("accepted", 200), person("accepted", 300)];
    expect(getExchangeNextStep(participantView({ exchange_participants: roster }))).toBe(
      "You're in. Waiting for the organizer to draw names."
    );
  });

  it("says nothing to someone who hasn't joined", () => {
    expect(getExchangeNextStep(participantView({ my_participant: { status: "declined" } }))).toBeNull();
    expect(getExchangeNextStep(participantView({ my_participant: null }))).toBeNull();
  });
});

describe("getExchangeNextStep after the draw", () => {
  it.each(["active", "completed"] as const)("says nothing once the exchange is %s", (status) => {
    expect(getExchangeNextStep(ownerView(joined(4), status))).toBeNull();
    expect(getExchangeNextStep(participantView({ status }))).toBeNull();
  });
});
