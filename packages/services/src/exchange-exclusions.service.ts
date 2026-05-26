import type { ApiClient } from "@niftygifty/api-client";
import type {
  CreateExchangeExclusionRequest,
  ExchangeExclusion,
} from "@niftygifty/types";

export interface ExchangeExclusionsService {
  getAll(exchangeId: number): Promise<ExchangeExclusion[]>;
  create(
    exchangeId: number,
    data: CreateExchangeExclusionRequest["exchange_exclusion"]
  ): Promise<ExchangeExclusion>;
  delete(exchangeId: number, exclusionId: number): Promise<void>;
}

export function createExchangeExclusionsService(client: ApiClient): ExchangeExclusionsService {
  function buildUrl(exchangeId: number, exclusionId?: number): string {
    const base = `/gift_exchanges/${exchangeId}/exchange_exclusions`;
    return exclusionId ? `${base}/${exclusionId}` : base;
  }

  return {
    getAll(exchangeId: number) {
      return client.get<ExchangeExclusion[]>(buildUrl(exchangeId));
    },

    create(exchangeId: number, data: CreateExchangeExclusionRequest["exchange_exclusion"]) {
      return client.post<ExchangeExclusion>(buildUrl(exchangeId), {
        exchange_exclusion: data,
      });
    },

    delete(exchangeId: number, exclusionId: number) {
      return client.delete(buildUrl(exchangeId, exclusionId));
    },
  };
}
