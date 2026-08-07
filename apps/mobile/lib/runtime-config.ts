const DEFAULT_API_URL = "https://api.listygifty.com";
const DEFAULT_WEB_APP_URL = "https://listygifty.com";
const DEFAULT_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsubGlzdHlnaWZ0eS5jb20k";

function getEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const runtimeConfig = {
  apiUrl: getEnvValue(process.env.EXPO_PUBLIC_API_URL) || DEFAULT_API_URL,
  webAppUrl: getEnvValue(process.env.EXPO_PUBLIC_WEB_APP_URL) || DEFAULT_WEB_APP_URL,
  clerkPublishableKey: getEnvValue(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) || DEFAULT_CLERK_PUBLISHABLE_KEY,
  screenshotMode: getEnvValue(process.env.EXPO_PUBLIC_SCREENSHOT_MODE) === "1",
  screenshotRoute: getEnvValue(process.env.EXPO_PUBLIC_SCREENSHOT_ROUTE) || "exchanges",
};
