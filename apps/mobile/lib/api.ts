import { ApiClient } from "@niftygifty/api-client";
import {
  createHolidaysService,
  createGiftsService,
  createGiftStatusesService,
  createPeopleService,
  createGiftExchangesService,
  createWishlistItemsService,
  createExchangeInvitesService,
} from "@niftygifty/services";
import { runtimeConfig } from "@/lib/runtime-config";

const API_URL = runtimeConfig.apiUrl;

// Create the API client instance
export const apiClient = new ApiClient({
  baseUrl: API_URL,
  debug: __DEV__,
});

// Create service instances
export const holidaysService = createHolidaysService(apiClient);
export const giftsService = createGiftsService(apiClient);
export const giftStatusesService = createGiftStatusesService(apiClient);
export const peopleService = createPeopleService(apiClient);

// Exchange services
export const giftExchangesService = createGiftExchangesService(apiClient);
export const wishlistItemsService = createWishlistItemsService(apiClient);
export const exchangeInvitesService = createExchangeInvitesService(apiClient);
