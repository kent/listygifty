import type {
  CreateExchangeParticipantRequest,
  CreateGiftExchangeRequest,
  GiftExchange,
} from "@niftygifty/types";
import { parseOptionalDecimal, trim, trimOrUndefined } from "./inputs";

const EXCHANGE_INVITE_BASE_URL = "https://listygifty.com/join/exchange";

export type ExchangeSection = {
  key: "owned" | "participating";
  title: string;
  data: GiftExchange[];
};

export interface ExchangeFormValues {
  name: string;
  exchangeDate: string;
  budgetMin: string;
  budgetMax: string;
}

export const EMPTY_EXCHANGE_FORM_VALUES: ExchangeFormValues = {
  name: "",
  exchangeDate: "",
  budgetMin: "",
  budgetMax: "",
};

export interface ExchangeParticipantFormValues {
  name: string;
  email: string;
}

export const EMPTY_EXCHANGE_PARTICIPANT_FORM_VALUES: ExchangeParticipantFormValues = {
  name: "",
  email: "",
};

export function buildExchangeSections(exchanges: GiftExchange[]): ExchangeSection[] {
  const owned = exchanges.filter((exchange) => exchange.is_owner);
  const participating = exchanges.filter((exchange) => !exchange.is_owner);
  const sections: ExchangeSection[] = [];

  if (owned.length > 0) {
    sections.push({ key: "owned", title: "My Exchanges", data: owned });
  }

  if (participating.length > 0) {
    sections.push({ key: "participating", title: "Participating In", data: participating });
  }

  return sections;
}

export function canStartExchange(exchange: GiftExchange): boolean {
  return (
    exchange.is_owner &&
    exchange.can_start &&
    exchange.status !== "active" &&
    exchange.status !== "completed"
  );
}

export function getExchangeStartBlocker(exchange: GiftExchange): string | null {
  if (!exchange.is_owner || exchange.status === "active" || exchange.status === "completed") {
    return null;
  }

  if (exchange.can_start) {
    return null;
  }

  if (exchange.status === "draft") {
    return "Add at least 3 participants to send invites before drawing matches.";
  }

  if (exchange.participant_count < 3) {
    const remaining = 3 - exchange.participant_count;
    return `Add ${remaining} more participant${remaining === 1 ? "" : "s"} before drawing matches.`;
  }

  if (exchange.accepted_count < exchange.participant_count) {
    const pending = exchange.participant_count - exchange.accepted_count;
    return `${pending} participant${pending === 1 ? "" : "s"} still need to accept.`;
  }

  return "Review participants before drawing matches.";
}

export function buildCreateExchangePayload(
  values: ExchangeFormValues
): CreateGiftExchangeRequest["gift_exchange"] {
  return {
    name: trim(values.name),
    exchange_date: trimOrUndefined(values.exchangeDate),
    budget_min: parseOptionalDecimal(values.budgetMin),
    budget_max: parseOptionalDecimal(values.budgetMax),
  };
}

export function buildCreateExchangeParticipantPayload(
  values: ExchangeParticipantFormValues
): CreateExchangeParticipantRequest["exchange_participant"] {
  return {
    name: trim(values.name),
    email: trim(values.email),
  };
}

export function buildExchangeInviteUrl(inviteToken: string): string {
  return `${EXCHANGE_INVITE_BASE_URL}/${encodeURIComponent(trim(inviteToken))}`;
}
