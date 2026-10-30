import type { ExchangeParticipant, GiftExchange } from "@niftygifty/types";

// Mirrors GiftExchange::MIN_PARTICIPANTS in the API.
const MIN_JOINED_TO_DRAW = 2;

export type NextStepExchange = Pick<
  GiftExchange,
  "status" | "is_owner" | "user_id" | "accepted_count"
> & {
  exchange_participants: Pick<ExchangeParticipant, "status" | "user_id" | "display_name">[];
  my_participant?: Pick<ExchangeParticipant, "status"> | null;
};

/** What the viewer should expect next, or null when there's nothing to say. */
export function getExchangeNextStep(exchange: NextStepExchange): string | null {
  if (exchange.status !== "draft" && exchange.status !== "inviting") return null;

  if (exchange.is_owner) return organizerNextStep(exchange);
  if (exchange.my_participant?.status !== "accepted") return null;

  // The API sends no owner name, but the roster has one if they joined their own exchange.
  const organizer = exchange.exchange_participants.find((p) => p.user_id === exchange.user_id);
  return `You're in. Waiting for ${organizer?.display_name ?? "the organizer"} to draw names.`;
}

function organizerNextStep(exchange: NextStepExchange): string {
  const joined = exchange.accepted_count;
  if (joined < MIN_JOINED_TO_DRAW) {
    return `You need at least ${MIN_JOINED_TO_DRAW} people to draw names. ${joined} joined so far.`;
  }

  // Declined people aren't waited on, so only open invites count.
  const pending = exchange.exchange_participants.filter((p) => p.status === "invited").length;
  if (pending === 0) return "Everyone's in. Draw names when you're ready.";

  const who = pending === 1 ? "1 person hasn't" : `${pending} people haven't`;
  return `Ready when you are. ${who} joined yet, and anyone who hasn't joined when you draw is left out.`;
}
