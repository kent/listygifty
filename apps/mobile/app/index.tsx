import { Redirect } from "expo-router";
import { runtimeConfig } from "@/lib/runtime-config";

export default function Index() {
  if (runtimeConfig.screenshotMode) {
    const routeMap: Record<string, "/(tabs)/lists" | "/(tabs)/exchanges" | "/(tabs)/people/index" | "/(tabs)/profile/index"> =
      {
        lists: "/(tabs)/lists",
        exchanges: "/(tabs)/exchanges",
        people: "/(tabs)/people/index",
        profile: "/(tabs)/profile/index",
      };

    return <Redirect href={routeMap[runtimeConfig.screenshotRoute] ?? "/(tabs)/lists"} />;
  }

  // Redirect to auth - the AuthRouter in _layout will handle
  // redirecting to (tabs) if already signed in
  return <Redirect href="/auth/login" />;
}
