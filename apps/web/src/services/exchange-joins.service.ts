import { apiClient } from "@/lib/api-client";
import type { ExchangeJoinDetails, ExchangeJoinResponse } from "@niftygifty/types";

class ExchangeJoinsService {
  // Public endpoint - no auth required
  async getJoinDetails(shareToken: string): Promise<ExchangeJoinDetails> {
    return apiClient.get<ExchangeJoinDetails>(`/exchange_join/${shareToken}`);
  }

  // Requires auth
  async join(shareToken: string, name?: string): Promise<ExchangeJoinResponse> {
    return apiClient.post<ExchangeJoinResponse>(
      `/exchange_join/${shareToken}/join`,
      name ? { name } : {}
    );
  }
}

export const exchangeJoinsService = new ExchangeJoinsService();
