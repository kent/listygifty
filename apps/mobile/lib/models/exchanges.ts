import type {
  CreateExchangeParticipantRequest,
  CreateGiftExchangeRequest,
  GiftExchange,
} from "@niftygifty/types";
import { parseOptionalDecimal, trim, trimOrUndefined } from "./inputs";

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
