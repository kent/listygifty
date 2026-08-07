import { apiClient } from "@/lib/api-client";

export interface OAuthConsent {
  client: {
    name: string;
    description: string | null;
    client_uri: string | null;
    redirect_uri: string;
    dynamically_registered: boolean;
    verified: boolean;
  };
  resource: {
    name: string;
    uri: string;
    admin: boolean;
  };
  requested_scopes: string[];
  user: {
    email: string;
    name: string;
  };
  expires_at: string;
}

interface OAuthDecisionResponse {
  redirect_uri: string;
}

class OAuthAuthorizationService {
  getConsent(requestToken: string, clerkToken: string, signal?: AbortSignal) {
    return apiClient.post<OAuthConsent>(
      "/oauth/authorize/consent",
      { request_token: requestToken },
      { headers: this.authHeaders(clerkToken), signal }
    );
  }

  decide(requestToken: string, decision: "approve" | "deny", clerkToken: string) {
    return apiClient.post<OAuthDecisionResponse>(
      "/oauth/authorize",
      { request_token: requestToken, decision },
      { headers: this.authHeaders(clerkToken) }
    );
  }

  private authHeaders(clerkToken: string) {
    return { Authorization: `Bearer ${clerkToken}` };
  }
}

export const oauthAuthorizationService = new OAuthAuthorizationService();
