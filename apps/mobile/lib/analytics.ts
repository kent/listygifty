import { useCallback } from "react";
import { usePostHog } from "posthog-react-native";
import { runtimeConfig } from "@/lib/runtime-config";

type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

export function useAnalytics() {
  const posthog = usePostHog() as
    | { capture?: (event: string, properties?: AnalyticsProperties) => void }
    | undefined;

  return useCallback(
    (event: string, properties?: AnalyticsProperties) => {
      if (runtimeConfig.screenshotMode || !runtimeConfig.posthogApiKey || !posthog?.capture) {
        return;
      }

      posthog.capture(event, properties);
    },
    [posthog]
  );
}
