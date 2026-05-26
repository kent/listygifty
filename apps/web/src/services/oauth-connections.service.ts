import type { OAuthConnection } from "@niftygifty/types";
import { apiClient } from "@/lib/api-client";

class OAuthConnectionsService {
  async getAll(): Promise<OAuthConnection[]> {
    return apiClient.get<OAuthConnection[]>("/oauth/connections");
  }

  async revoke(clientId: string): Promise<void> {
    return apiClient.delete(`/oauth/connections/${encodeURIComponent(clientId)}`);
  }
}

export const oauthConnectionsService = new OAuthConnectionsService();
