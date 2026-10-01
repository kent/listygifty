import { useLayoutEffect, useMemo } from "react";
import { useAuth } from "@clerk/clerk-expo";
import {
  configureApiSession,
  holidaysService,
  giftsService,
  giftStatusesService,
  peopleService,
  giftExchangesService,
  exchangeParticipantsService,
  exchangeExclusionsService,
  wishlistItemsService,
  exchangeInvitesService,
  exchangeJoinsService,
} from "./api";
import { runtimeConfig } from "@/lib/runtime-config";
import { screenshotServices } from "@/lib/screenshot-mocks";
import { useDemoMode } from "@/lib/demo-mode";
import { demoServices } from "@/lib/demo-services";

/**
 * Hook that configures the API client with the current Clerk session token.
 * Call this once in your app to enable authenticated API requests.
 */
export function useApiSetup() {
  const { getToken, userId, isLoaded } = useAuth();
  const demo = useDemoMode();

  useLayoutEffect(() => {
    if (runtimeConfig.screenshotMode || !isLoaded) return;
    configureApiSession(demo ? null : userId ?? null, getToken);
  }, [demo, getToken, userId, isLoaded]);
}

/**
 * Hook that returns configured service instances.
 * Ensures the API client is set up with auth before returning services.
 */
export function useServices() {
  const demo = useDemoMode();
  useApiSetup();

  const services = useMemo(
    () => ({
      holidays: holidaysService,
      gifts: giftsService,
      giftStatuses: giftStatusesService,
      people: peopleService,
      giftExchanges: giftExchangesService,
      exchangeParticipants: exchangeParticipantsService,
      exchangeExclusions: exchangeExclusionsService,
      wishlistItems: wishlistItemsService,
      exchangeInvites: exchangeInvitesService,
      exchangeJoins: exchangeJoinsService,
    }),
    []
  );
  if (demo) return demoServices as unknown as typeof services;
  return runtimeConfig.screenshotMode ? screenshotServices as unknown as typeof services : services;
}
