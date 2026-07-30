import { apiClient } from "@/lib/api-client";
import type { ExchangeNotification } from "@niftygifty/types";

class ExchangeNotificationsService {
  async getAll(exchangeId: number): Promise<ExchangeNotification[]> {
    return apiClient.get(`/gift_exchanges/${exchangeId}/exchange_notifications`);
  }

  async markRead(exchangeId: number, notificationId: number): Promise<ExchangeNotification> {
    return apiClient.patch(
      `/gift_exchanges/${exchangeId}/exchange_notifications/${notificationId}/read`
    );
  }
}

export const exchangeNotificationsService = new ExchangeNotificationsService();
