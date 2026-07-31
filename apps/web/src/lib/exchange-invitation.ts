import type { ExchangeJoinDetails } from "@niftygifty/types";

type PublicExchange = ExchangeJoinDetails["exchange"];

export function formatExchangeDate(date: string | null, includeWeekday = true): string | null {
  if (!date) return null;

  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    ...(includeWeekday ? { weekday: "long" as const } : {}),
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatExchangeBudget(exchange: PublicExchange): string | null {
  const minimum = exchange.budget_min ? Number.parseFloat(exchange.budget_min) : null;
  const maximum = exchange.budget_max ? Number.parseFloat(exchange.budget_max) : null;

  if (minimum !== null && maximum !== null) return `$${minimum.toFixed(0)}–$${maximum.toFixed(0)}`;
  if (maximum !== null) return `Up to $${maximum.toFixed(0)}`;
  if (minimum !== null) return `At least $${minimum.toFixed(0)}`;
  return null;
}

export function invitationDescription(details: ExchangeJoinDetails): string {
  const context = [
    formatExchangeDate(details.exchange.exchange_date, false),
    formatExchangeBudget(details.exchange),
    `${details.exchange.accepted_count} ${details.exchange.accepted_count === 1 ? "person" : "people"} already in`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `${details.exchange.owner_name} invited you to join ${details.exchange.name} on Listy Gifty. ${context}`;
}
