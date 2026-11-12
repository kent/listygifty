import type { ApiClient } from "@niftygifty/api-client";
import type { ExchangeNotification } from "@niftygifty/types";

export interface ExchangeNotificationsService {
  getAll(exchangeId: number): Promise<ExchangeNotification[]>;
}

export function createExchangeNotificationsService(client: ApiClient): ExchangeNotificationsService {
  return {
    getAll(exchangeId) {
      return client.get<ExchangeNotification[]>(`/gift_exchanges/${exchangeId}/exchange_notifications`);
    },
  };
}
