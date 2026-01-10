import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { PostHogProvider } from "posthog-react-native";
import { tokenCache } from "@/lib/token-cache";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { ThemeProvider, useTheme } from "@/lib/theme";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY || "REDACTED_POSTHOG_KEY_ROTATED_2026_05";

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
}

function AuthRouter() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors, isDark } = useTheme();

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
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{
        host: "https://us.i.posthog.com",
      }}
    >
      <ThemeProvider>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ClerkLoaded>
            <AuthRouter />
          </ClerkLoaded>
        </ClerkProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
