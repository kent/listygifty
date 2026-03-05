import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import {
  apiClient,
  holidaysService,
  giftsService,
  giftStatusesService,
  peopleService,
  giftExchangesService,
  wishlistItemsService,
  exchangeInvitesService,
} from "./api";
import { runtimeConfig } from "@/lib/runtime-config";
import { screenshotServices } from "@/lib/screenshot-mocks";

/**
 * Hook that configures the API client with the current Clerk session token.
 * Call this once in your app to enable authenticated API requests.
 */
export function useApiSetup() {
  const { getToken } = useAuth();

  useEffect(() => {
    if (runtimeConfig.screenshotMode) return;
    apiClient.setTokenGetter(getToken);
  }, [getToken]);
}

/**
 * Hook that returns configured service instances.
 * Ensures the API client is set up with auth before returning services.
 */
export function useServices() {
  if (runtimeConfig.screenshotMode) {
    return screenshotServices as unknown as {
      holidays: typeof holidaysService;
      gifts: typeof giftsService;
      giftStatuses: typeof giftStatusesService;
      people: typeof peopleService;
      giftExchanges: typeof giftExchangesService;
      wishlistItems: typeof wishlistItemsService;
      exchangeInvites: typeof exchangeInvitesService;
    };
  }

  useApiSetup();

  return {
    holidays: holidaysService,
    gifts: giftsService,
    giftStatuses: giftStatusesService,
    people: peopleService,
    giftExchanges: giftExchangesService,
    wishlistItems: wishlistItemsService,
    exchangeInvites: exchangeInvitesService,
  };
}
