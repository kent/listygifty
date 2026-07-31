import type { ApiClient } from "@niftygifty/api-client";
import type { ExchangeJoinDetails, ExchangeJoinResponse } from "@niftygifty/types";

export interface ExchangeJoinsService {
  getDetails(shareToken: string): Promise<ExchangeJoinDetails>;
  join(shareToken: string, name?: string): Promise<ExchangeJoinResponse>;
}

export function createExchangeJoinsService(client: ApiClient): ExchangeJoinsService {
  return {
    getDetails(shareToken: string) {
      return client.get<ExchangeJoinDetails>(
        `/exchange_join/${encodeURIComponent(shareToken)}`
      );
    },

    join(shareToken: string, name?: string) {
      const normalizedName = name?.trim();
      return client.post<ExchangeJoinResponse>(
        `/exchange_join/${encodeURIComponent(shareToken)}/join`,
        normalizedName ? { name: normalizedName } : {}
      );
    },
  };
}
