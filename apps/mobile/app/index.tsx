import { Redirect } from "expo-router";
import { runtimeConfig } from "@/lib/runtime-config";
import { getActiveScreenshotRouteName, getScreenshotRouteTarget } from "@/lib/screenshot-routes";

export default function Index() {
  if (runtimeConfig.screenshotMode) {
    return (
      <Redirect
        href={getScreenshotRouteTarget(
          getActiveScreenshotRouteName(runtimeConfig.screenshotRoute)
        )}
      />
    );
  }

  // Redirect to auth - the AuthRouter in _layout will handle
  // redirecting to (tabs) if already signed in
  return <Redirect href="/auth/login" />;
}
