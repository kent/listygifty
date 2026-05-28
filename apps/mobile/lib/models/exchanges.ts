import type {
  CreateExchangeParticipantRequest,
  CreateExchangeExclusionRequest,
  ExchangeExclusion,
  CreateGiftExchangeRequest,
  GiftExchange,
  GiftExchangeWithParticipants,
} from "@niftygifty/types";
import { parseLocalDate } from "@/lib/formatters";
import { parseOptionalDecimal, trim, trimOrUndefined } from "./inputs";
import { runtimeConfig } from "@/lib/runtime-config";

const EXCHANGE_INVITE_PATH = "/join/exchange";
const DEFAULT_EXCHANGE_REMINDER_HOUR = 9;
const FAMILY_BUDGET_MIN = "25";
const FAMILY_BUDGET_MAX = "50";

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
  includeCreator: boolean;
}

export const EMPTY_EXCHANGE_FORM_VALUES: ExchangeFormValues = {
  name: "",
  exchangeDate: "",
  budgetMin: "",
  budgetMax: "",
  includeCreator: true,
};

export interface ExchangeParticipantFormValues {
  name: string;
  email: string;
}

export const EMPTY_EXCHANGE_PARTICIPANT_FORM_VALUES: ExchangeParticipantFormValues = {
  name: "",
  email: "",
};

export interface ExchangeExclusionFormValues {
  participantAId: number | null;
  participantBId: number | null;
}

export const EMPTY_EXCHANGE_EXCLUSION_FORM_VALUES: ExchangeExclusionFormValues = {
  participantAId: null,
  participantBId: null,
};

export interface ExchangeReadinessItem {
  key: "participants" | "acceptances" | "wishlists" | "exclusions";
  label: string;
  detail: string;
  complete: boolean;
  required: boolean;
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function getNextAnnualDate(month: number, day: number, now: Date): string {
  let year = now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(year, month - 1, day);

  if (candidate < today) {
    year += 1;
  }

  return toIsoDate(year, month, day);
}

export function buildFamilyExchangeFormValues(now: Date = new Date()): ExchangeFormValues {
  const exchangeDate = getNextAnnualDate(12, 25, now);
  const year = exchangeDate.split("-")[0];

  return {
    name: `Family Christmas ${year}`,
    exchangeDate,
    budgetMin: FAMILY_BUDGET_MIN,
    budgetMax: FAMILY_BUDGET_MAX,
    includeCreator: true,
  };
}

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

export function canManageExchangeWishlist(exchange: GiftExchange): boolean {
  return (
    exchange.my_participant?.status === "accepted" &&
    exchange.status !== "completed"
  );
}

export function getExchangeWishlistSubtitle(exchange: GiftExchange): string {
  const count = exchange.my_participant?.wishlist_count ?? 0;
  const itemLabel = `${count} item${count === 1 ? "" : "s"}`;

  if (exchange.status === "active") {
    return itemLabel;
  }

  return `${itemLabel} before matches are drawn`;
}

export function getExchangeReminderDate(
  exchange: Pick<GiftExchange, "exchange_date" | "status">,
  now: Date = new Date()
): Date | null {
  if (!exchange.exchange_date || exchange.status === "completed") {
    return null;
  }

  const exchangeDate = parseLocalDate(exchange.exchange_date);
  if (Number.isNaN(exchangeDate.getTime())) {
    return null;
  }

  const dayBefore = new Date(
    exchangeDate.getFullYear(),
    exchangeDate.getMonth(),
    exchangeDate.getDate() - 1,
    DEFAULT_EXCHANGE_REMINDER_HOUR,
    0,
    0,
    0
  );
  if (dayBefore > now) {
    return dayBefore;
  }

  const exchangeMorning = new Date(
    exchangeDate.getFullYear(),
    exchangeDate.getMonth(),
    exchangeDate.getDate(),
    DEFAULT_EXCHANGE_REMINDER_HOUR,
    0,
    0,
    0
  );

  return exchangeMorning > now ? exchangeMorning : null;
}

export function canScheduleExchangeReminder(exchange: GiftExchange): boolean {
  return getExchangeReminderDate(exchange) !== null;
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

export function getExchangeReadinessItems(
  exchange: GiftExchangeWithParticipants,
  exclusionCount = 0
): ExchangeReadinessItem[] {
  if (!exchange.is_owner || exchange.status === "active" || exchange.status === "completed") {
    return [];
  }

  const participantCount = exchange.exchange_participants.length || exchange.participant_count;
  const acceptedParticipants = exchange.exchange_participants.filter(
    (participant) => participant.status === "accepted"
  );
  const participantsReady = participantCount >= 3;
  const acceptancesReady = participantsReady && acceptedParticipants.length === participantCount;
  const acceptedWishlists = acceptedParticipants.filter(
    (participant) => participant.wishlist_count > 0
  ).length;
  const wishlistsReady =
    acceptedParticipants.length > 0 &&
    acceptedParticipants.every((participant) => participant.wishlist_count > 0);

  return [
    {
      key: "participants",
      label: "Participants",
      detail: `${Math.min(participantCount, 3)}/3 minimum`,
      complete: participantsReady,
      required: true,
    },
    {
      key: "acceptances",
      label: "Accepted invites",
      detail: `${acceptedParticipants.length}/${participantCount || 0} accepted`,
      complete: acceptancesReady,
      required: true,
    },
    {
      key: "wishlists",
      label: "Wishlists started",
      detail: `${acceptedWishlists}/${acceptedParticipants.length || 0} accepted participants`,
      complete: wishlistsReady,
      required: false,
    },
    {
      key: "exclusions",
      label: "Exclusion rules",
      detail: `${exclusionCount} rule${exclusionCount === 1 ? "" : "s"}`,
      complete: true,
      required: false,
    },
  ];
}

export function buildCreateExchangePayload(
  values: ExchangeFormValues
): CreateGiftExchangeRequest["gift_exchange"] {
  return {
    name: trim(values.name),
    exchange_date: trimOrUndefined(values.exchangeDate),
    budget_min: parseOptionalDecimal(values.budgetMin),
    budget_max: parseOptionalDecimal(values.budgetMax),
    include_creator: values.includeCreator,
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

export function buildCreateExchangeExclusionPayload(
  values: ExchangeExclusionFormValues
): CreateExchangeExclusionRequest["exchange_exclusion"] {
  if (!values.participantAId || !values.participantBId) {
    throw new Error("Both participants are required");
  }

  return {
    participant_a_id: values.participantAId,
    participant_b_id: values.participantBId,
  };
}

export function hasExchangeExclusionBetween(
  exclusions: ExchangeExclusion[],
  participantAId: number | null,
  participantBId: number | null
): boolean {
  if (!participantAId || !participantBId) {
    return false;
  }

  return exclusions.some(
    (exclusion) =>
      (exclusion.participant_a_id === participantAId &&
        exclusion.participant_b_id === participantBId) ||
      (exclusion.participant_a_id === participantBId &&
        exclusion.participant_b_id === participantAId)
  );
}

export function buildExchangeInviteUrl(inviteToken: string): string {
  const baseUrl = runtimeConfig.webAppUrl.replace(/\/+$/, "");
  return `${baseUrl}${EXCHANGE_INVITE_PATH}/${encodeURIComponent(trim(inviteToken))}`;
}
