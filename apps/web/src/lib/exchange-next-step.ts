import type { GiftExchange } from "@niftygifty/types";
import { parseDateOnly } from "@/lib/dates";

/** The one thing to do next, for someone landing on Home. */
export function exchangeNextStep(exchange: GiftExchange): { text: string; href: string } {
  const href = `/exchanges/${exchange.slug}`;
  const joined = `${exchange.accepted_count} of ${exchange.participant_count} joined.`;

  if (exchange.status === "active") {
    return exchange.capabilities.view_match
      ? { text: "Names are drawn. See who you're buying for.", href: `${href}/my-match` }
      : { text: "Names are drawn.", href };
  }
  if (exchange.capabilities.publish) return { text: `${joined} Draw names when you're ready.`, href };
  if (exchange.is_owner) return { text: `${joined} Waiting for more people.`, href };
  return { text: `${joined} Waiting for names to be drawn.`, href };
}

export function upcomingExchanges(exchanges: GiftExchange[], today: Date): GiftExchange[] {
  return exchanges.filter((exchange) => {
    if (exchange.status === "completed") return false;
    const date = parseDateOnly(exchange.exchange_date);
    return !date || date >= today;
  });
}
