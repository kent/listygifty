"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useCallback,
  useState,
  useMemo,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User, BillingStatus } from "@niftygifty/types";
import { FREE_GIFT_LIMIT } from "@niftygifty/types";
import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
  useClerk,
} from "@clerk/nextjs";
import { billingService, mapClerkUser } from "@/services";
import { apiClient } from "@/lib/api-client";
import { useRequestGuard } from "@/hooks/use-request-guard";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Auth actions
  signOut: () => Promise<void>;
  hydrateBillingStatus: (status: BillingStatus | null) => void;
  // Billing
  billingStatus: BillingStatus | null;
  isPremium: boolean;
  canCreateGift: boolean;
  giftsRemaining: number | null;
  refreshBillingStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded: isAuthLoaded } = useClerkAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useClerkUser();
  const clerk = useClerk();
  const router = useRouter();

  const userId = clerkUser?.id ?? null;
  const [billingSnapshot, setBillingSnapshot] = useState<{ userId: string; status: BillingStatus | null } | null>(null);
  const billingStatus = billingSnapshot?.userId === userId ? billingSnapshot.status : null;
  const { start, invalidate, isActive } = useRequestGuard(userId);

  // Configure apiClient to use Clerk token
  useLayoutEffect(() => {
    apiClient.setTokenGetter(async () => {
      return await getToken();
    });
  }, [getToken]);

  const isAuthenticated = !!clerkUser;
  const isLoading = !isAuthLoaded || !isUserLoaded;

  // Memoize user to prevent unnecessary re-renders
  const user = useMemo(
    () => mapClerkUser(clerkUser, billingStatus),
    [clerkUser, billingStatus]
  );

  const refreshBillingStatus = useCallback(async () => {
    if (userId && isActive()) {
      const isCurrent = start();
      try {
        const status = await billingService.getStatus();
        if (isCurrent()) setBillingSnapshot({ userId, status });
      } catch {
        // Silently fail - billing might not be set up yet
      }
    }
  }, [userId, isActive, start]);

  const hydrateBillingStatus = useCallback((status: BillingStatus | null) => {
    if (!userId || !isActive()) return;
    invalidate();
    setBillingSnapshot({ userId, status });
  }, [userId, invalidate, isActive]);

  // Sign out via Clerk and redirect to homepage
  const signOut = useCallback(async () => {
    invalidate();
    setBillingSnapshot(null);
    await clerk.signOut();
    toast.success("Signed out");
    router.push("/");
  }, [clerk, router, invalidate]);

  // Memoize derived billing values
  const billingValues = useMemo(() => {
    const isPremium = isAuthenticated && billingStatus?.subscription_status === "active";
    const canCreateGift = isAuthenticated ? (billingStatus?.can_create_gift ?? true) : false;
    const giftsRemaining = isAuthenticated
      ? (billingStatus?.gifts_remaining ?? FREE_GIFT_LIMIT)
      : null;
    return { isPremium, canCreateGift, giftsRemaining };
  }, [billingStatus, isAuthenticated]);

  // Memoize the entire context value
  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      signOut,
      hydrateBillingStatus,
      billingStatus,
      ...billingValues,
      refreshBillingStatus,
    }),
    [user, isLoading, isAuthenticated, signOut, hydrateBillingStatus, billingStatus, billingValues, refreshBillingStatus]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Noop auth provider for build-time rendering when Clerk is not available.
 * Provides safe defaults that prevent errors during static generation.
 */
export function NoopAuthProvider({ children }: { children: ReactNode }) {
  const noopValue: AuthContextType = {
    user: null,
    isLoading: true,
    isAuthenticated: false,
    signOut: async () => {},
    hydrateBillingStatus: () => {},
    billingStatus: null,
    isPremium: false,
    canCreateGift: false,
    giftsRemaining: null,
    refreshBillingStatus: async () => {},
  };

  return (
    <AuthContext.Provider value={noopValue}>{children}</AuthContext.Provider>
  );
}
