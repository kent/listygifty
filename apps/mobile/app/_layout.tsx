import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { PostHogProvider } from "posthog-react-native";
import { LogBox } from "react-native";
import { tokenCache } from "@/lib/token-cache";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ScreenLoader } from "@/components/ScreenLoader";
import { runtimeConfig } from "@/lib/runtime-config";
import { clearCachedResources } from "@/lib/api";

const publishableKey = runtimeConfig.clerkPublishableKey;
const posthogApiKey = runtimeConfig.posthogApiKey;
const posthogHost = runtimeConfig.posthogHost;

if (runtimeConfig.screenshotMode) {
  // Hide development warning overlays while capturing App Store screenshots.
  LogBox.ignoreAllLogs(true);
}

function ScreenshotRouter() {
  const router = useRouter();
  const segments = useSegments();
  const { isDark } = useTheme();

  useEffect(() => {
    const routeMap: Record<string, "/(tabs)/lists" | "/(tabs)/exchanges" | "/(tabs)/people/index" | "/(tabs)/profile/index"> =
      {
        lists: "/(tabs)/lists",
        exchanges: "/(tabs)/exchanges",
        people: "/(tabs)/people/index",
        profile: "/(tabs)/profile/index",
      };

    const targetRoute = routeMap[runtimeConfig.screenshotRoute] ?? "/(tabs)/lists";
    const currentRoute = segments.join("/");
    const normalizedTarget = targetRoute.replace(/^\//, "");

    if (currentRoute !== normalizedTarget) {
      router.replace(targetRoute);
    }
  }, [router, segments, runtimeConfig.screenshotRoute]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Slot />
    </>
  );
}

function AuthRouter() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "auth";
    const inJoinGroup = segments[0] === "join"; // Deep link routes

    if (runtimeConfig.screenshotMode) {
      if (inAuthGroup) {
        router.replace("/(tabs)/lists");
      }
      return;
    }

    if (!isSignedIn) {
      clearCachedResources();
    }

    if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)/lists");
    } else if (!isSignedIn && !inAuthGroup && !inJoinGroup) {
      router.replace("/auth/login");
    }
  }, [isLoaded, isSignedIn, segments]);

  if (!isLoaded) {
    return <ScreenLoader />;
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  if (runtimeConfig.screenshotMode) {
    return (
      <ThemeProvider>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ClerkLoaded>
            <ScreenshotRouter />
          </ClerkLoaded>
        </ClerkProvider>
      </ThemeProvider>
    );
  }

  const appShell = (
    <ThemeProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ClerkLoaded>
          <AuthRouter />
        </ClerkLoaded>
      </ClerkProvider>
    </ThemeProvider>
  );

  if (!posthogApiKey) {
    return appShell;
  }

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{
        host: posthogHost,
      }}
    >
      {appShell}
    </PostHogProvider>
  );
}
