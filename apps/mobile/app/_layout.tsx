import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { PostHogProvider } from "posthog-react-native";
import { tokenCache } from "@/lib/token-cache";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ScreenLoader } from "@/components/ScreenLoader";
import { Text, View } from "react-native";
import { isIOS26OrHigher } from "@/lib/platform";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const shouldDisableSecureTokenCache = isIOS26OrHigher();

function StartupConfigErrorScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        paddingHorizontal: 24,
      }}
    >
      <StatusBar style="light" />
      <Text style={{ color: "#f8fafc", fontSize: 24, fontWeight: "700", marginBottom: 12, textAlign: "center" }}>
        Listy Gifty Setup Required
      </Text>
      <Text style={{ color: "#cbd5e1", fontSize: 16, lineHeight: 22, textAlign: "center" }}>
        This build is missing runtime configuration. Please update the mobile build environment and try again.
      </Text>
    </View>
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
  if (!publishableKey) {
    return <StartupConfigErrorScreen />;
  }

  const appShell = (
    <ThemeProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={shouldDisableSecureTokenCache ? undefined : tokenCache}>
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
