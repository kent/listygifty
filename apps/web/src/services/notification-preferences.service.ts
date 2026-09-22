import { ApiClient } from "@niftygifty/api-client";
import { apiClient } from "@/lib/api-client";
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesRequest,
  EmailDeliverySummary,
  EmailPreferencesResponse,
} from "@niftygifty/types";

// Server URL for token-based requests (no auth header)
const publicClient = new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001" });

class NotificationPreferencesService {
  // Authenticated endpoints (current user)
  async get(): Promise<NotificationPreferences> {
    return apiClient.get<NotificationPreferences>("/notification_preferences");
  }

  async update(data: UpdateNotificationPreferencesRequest): Promise<NotificationPreferences> {
    return apiClient.patch<NotificationPreferences>("/notification_preferences", data);
  }

  async getEmailHistory(): Promise<EmailDeliverySummary[]> {
    return apiClient.get<EmailDeliverySummary[]>("/notification_preferences/email_history");
  }

  // Token-based endpoints (no auth required, for email unsubscribe links)
  async getByToken(token: string): Promise<EmailPreferencesResponse> {
    return publicClient.get<EmailPreferencesResponse>(`/email_preferences/${encodeURIComponent(token)}`);
  }

  async updateByToken(
    token: string,
    data: UpdateNotificationPreferencesRequest
  ): Promise<EmailPreferencesResponse> {
    return publicClient.patch<EmailPreferencesResponse>(`/email_preferences/${encodeURIComponent(token)}`, data);
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();

