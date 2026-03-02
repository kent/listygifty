const DEFAULT_API_URL = "https://api.listygifty.com";
const DEFAULT_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsubGlzdHlnaWZ0eS5jb20k";
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

function getEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const runtimeConfig = {
  apiUrl: getEnvValue(process.env.EXPO_PUBLIC_API_URL) || DEFAULT_API_URL,
  clerkPublishableKey: getEnvValue(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) || DEFAULT_CLERK_PUBLISHABLE_KEY,
  posthogApiKey: getEnvValue(process.env.EXPO_PUBLIC_POSTHOG_KEY),
  posthogHost: getEnvValue(process.env.EXPO_PUBLIC_POSTHOG_HOST) || DEFAULT_POSTHOG_HOST,
};
