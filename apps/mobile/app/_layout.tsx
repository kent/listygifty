import { useEffect } from "react";
import { Slot, useGlobalSearchParams, usePathname, useRouter, useSegments } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { AppState, LogBox } from "react-native";
import { tokenCache } from "@/lib/token-cache";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ScreenLoader } from "@/components/ScreenLoader";
import { runtimeConfig } from "@/lib/runtime-config";
import { clearCachedResources } from "@/lib/api";
import { normalizeAuthReturnPath } from "@/lib/auth-return";
import { flushAnalyticsEvents, useAnalytics } from "@/lib/analytics";
import { useApiSetup } from "@/lib/use-api";
import {
  getActiveScreenshotRouteName,
  getScreenshotRouteTarget,
  getScreenshotTargetPath,
} from "@/lib/screenshot-routes";

const publishableKey = runtimeConfig.clerkPublishableKey;

if (runtimeConfig.screenshotMode) {
  // Hide development warning overlays while capturing App Store screenshots.
  LogBox.ignoreAllLogs(true);
}

function ScreenshotRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDark } = useTheme();
  const routeName = getActiveScreenshotRouteName(runtimeConfig.screenshotRoute);

  useEffect(() => {
    const targetRoute = getScreenshotRouteTarget(routeName);
    const currentRoute = pathname.replace(/^\//, "");
    const normalizedTarget = getScreenshotTargetPath(targetRoute);

    if (currentRoute !== normalizedTarget) {
      router.replace(targetRoute);
    }
  }, [pathname, routeName, router]);

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
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string | string[] }>();
  const router = useRouter();
  const { isDark } = useTheme();
  const capture = useAnalytics();
  const pathname = usePathname();
  useApiSetup();

  useEffect(() => {
    capture("mobile_screen_viewed", { path: pathname });
  }, [capture, pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flushAnalyticsEvents();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "auth";
    const inJoinGroup = segments[0] === "join"; // Deep link routes
    const inSharedExchangeGroup = segments[0] === "e";
    const authReturnPath = normalizeAuthReturnPath(returnTo);

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
      router.replace(authReturnPath || "/(tabs)/lists");
    } else if (!isSignedIn && !inAuthGroup && !inJoinGroup && !inSharedExchangeGroup) {
      router.replace("/auth/login");
    }
  }, [isLoaded, isSignedIn, returnTo, router, segments]);

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
          <ScreenshotRouter />
        </ClerkProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ClerkLoaded>
          <AuthRouter />
        </ClerkLoaded>
      </ClerkProvider>
    </ThemeProvider>
  );
}
