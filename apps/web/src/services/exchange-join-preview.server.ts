import { cache } from "react";
import type { ExchangeJoinDetails } from "@niftygifty/types";

const apiUrl = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");

export const getExchangeJoinPreview = cache(
  async (shareToken: string): Promise<ExchangeJoinDetails | null> => {
    try {
      const response = await fetch(`${apiUrl}/exchange_join/${encodeURIComponent(shareToken)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) return null;
      return (await response.json()) as ExchangeJoinDetails;
    } catch {
      return null;
    }
  }
);
