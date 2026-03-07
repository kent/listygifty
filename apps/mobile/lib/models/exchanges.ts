import type { GiftExchange } from "@niftygifty/types";

export type ExchangeSection = {
  key: "owned" | "participating";
  title: string;
  data: GiftExchange[];
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
