import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { PostHogProvider } from "posthog-react-native";
import { tokenCache } from "@/lib/token-cache";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ScreenLoader } from "@/components/ScreenLoader";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
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
