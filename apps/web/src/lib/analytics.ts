type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

declare global {
  interface Window {
    posthog?: {
      capture?: (event: string, properties?: AnalyticsProperties) => void;
    };
  }
}

export function captureWebEvent(event: string, properties?: AnalyticsProperties) {
  if (typeof window === "undefined") {
    return;
  }

  window.posthog?.capture?.(event, properties);
}
