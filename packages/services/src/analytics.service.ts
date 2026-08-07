import type { AnalyticsEventInput, AnalyticsIngestionResponse } from "@niftygifty/types";
import type { ApiClient } from "@niftygifty/api-client";

export interface AnalyticsService {
  captureBatch(events: AnalyticsEventInput[]): Promise<AnalyticsIngestionResponse>;
}

export function createAnalyticsService(client: ApiClient): AnalyticsService {
  return {
    captureBatch(events) {
      return client.post<AnalyticsIngestionResponse>("/analytics/events", { events }, { keepalive: true, timeout: 5_000 });
    },
  };
}
