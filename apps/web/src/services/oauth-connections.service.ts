import { OAUTH_CONNECTION_ENDPOINTS, type OAuthConnection } from "@niftygifty/types";
import { apiClient } from "@/lib/api-client";

class OAuthConnectionsService {
  async getAll(): Promise<OAuthConnection[]> {
    return apiClient.get<OAuthConnection[]>(OAUTH_CONNECTION_ENDPOINTS.oauthConnections);
  }

  async revoke(clientId: string): Promise<void> {
    return apiClient.delete(
      OAUTH_CONNECTION_ENDPOINTS.oauthConnection(encodeURIComponent(clientId))
    );
  }
}

export const oauthConnectionsService = new OAuthConnectionsService();
