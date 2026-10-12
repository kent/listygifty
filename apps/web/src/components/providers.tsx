"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider, useTheme } from "next-themes";
import { AuthProvider, NoopAuthProvider } from "@/contexts/auth-context";
import { WorkspaceProvider, NoopWorkspaceProvider } from "@/contexts/workspace-context";
import { getClerkAppearance } from "@/services";
import { ReactNode, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_IDS } from "@/lib/themes";

// One-click themes: each sets data-theme on <html> (see src/lib/themes.ts).
const THEME_PROVIDER_PROPS = {
  attribute: "data-theme",
  themes: THEME_IDS,
  defaultTheme: DEFAULT_THEME,
  enableSystem: false,
  storageKey: "listygifty-theme",
  disableTransitionOnChange: true,
} as const;

interface ProvidersProps {
  children: ReactNode;
}

// Check if we have a valid Clerk publishable key (not a dummy build key)
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const hasValidClerkKey =
  publishableKey && !publishableKey.includes("dummy_key");

// Hydration-safe mounted check using useSyncExternalStore
const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Theme-aware Clerk provider that updates appearance when theme changes.
 */
function ThemedClerkProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const mounted = useIsMounted();

  // Use the default theme's appearance during SSR and before mount
  const appearance = getClerkAppearance(mounted ? theme : DEFAULT_THEME);

  return (
    <ClerkProvider appearance={appearance}>
      <AuthProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}

/**
 * Client-side providers wrapper.
 * Wraps the app with Clerk, Theme, and Auth providers.
 * Uses NoopAuthProvider during build when no valid key exists.
 */
export function Providers({ children }: ProvidersProps) {
  if (!hasValidClerkKey) {
    return (
      <ThemeProvider
        {...THEME_PROVIDER_PROPS}
      >
        <NoopAuthProvider>
          <NoopWorkspaceProvider>{children}</NoopWorkspaceProvider>
        </NoopAuthProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider
      {...THEME_PROVIDER_PROPS}
    >
      <ThemedClerkProvider>{children}</ThemedClerkProvider>
    </ThemeProvider>
  );
}

