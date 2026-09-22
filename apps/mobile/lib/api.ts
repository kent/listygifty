import { ApiClient } from "@niftygifty/api-client";
import {
  createBootstrapService,
  createHolidaysService,
  createGiftsService,
  createGiftStatusesService,
  createPeopleService,
  createGiftExchangesService,
  createExchangeParticipantsService,
  createExchangeExclusionsService,
  createWishlistItemsService,
  createExchangeInvitesService,
  createExchangeJoinsService,
  createAnalyticsService,
} from "@niftygifty/services";
import { runtimeConfig } from "@/lib/runtime-config";
import {
  clearCachedResources as clearResourceCache,
  invalidateCachedResources,
  peekCachedResource,
  primeCachedResource,
  readCachedResource,
} from "@/lib/resource-cache";

const API_URL = runtimeConfig.apiUrl;
const BOOTSTRAP_TTL_MS = 60_000;
const CACHE_TTL_MS = {
  holidays: 60_000,
  holiday: 60_000,
  gifts: 30_000,
  gift: 30_000,
  giftStatuses: 6 * 60 * 60 * 1000,
  people: 60_000,
  exchanges: 60_000,
} as const;

// Create the API client instance
export const apiClient = new ApiClient({
  baseUrl: API_URL,
  debug: __DEV__,
});
export const analyticsService = createAnalyticsService(apiClient);

const baseHolidaysService = createHolidaysService(apiClient);
const baseGiftsService = createGiftsService(apiClient);
const baseGiftStatusesService = createGiftStatusesService(apiClient);
const basePeopleService = createPeopleService(apiClient);
const baseGiftExchangesService = createGiftExchangesService(apiClient);
const baseExchangeParticipantsService = createExchangeParticipantsService(apiClient);
const baseExchangeExclusionsService = createExchangeExclusionsService(apiClient);
const baseBootstrapService = createBootstrapService(apiClient);
export const wishlistItemsService = createWishlistItemsService(apiClient);
export const exchangeInvitesService = createExchangeInvitesService(apiClient);
const baseExchangeJoinsService = createExchangeJoinsService(apiClient);

let bootstrapPromise: Promise<void> | null = null;
let bootstrapExpiresAt = 0;
let sessionUserId: string | null = null;
let sessionGeneration = 0;

export function configureApiSession(userId: string | null, getToken: () => Promise<string | null>) {
  if (sessionUserId !== userId) {
    sessionUserId = userId;
    clearCachedResources();
    apiClient.setWorkspaceId(null);
  }
  apiClient.setTokenGetter(userId ? getToken : async () => null);
}

function resetBootstrapState() {
  bootstrapPromise = null;
  bootstrapExpiresAt = 0;
}

function seedShellCache(data: {
  holiday_templates: Awaited<ReturnType<typeof baseHolidaysService.getTemplates>>;
  holidays: Awaited<ReturnType<typeof baseHolidaysService.getAll>>;
  people: Awaited<ReturnType<typeof basePeopleService.getAll>>;
  gift_statuses: Awaited<ReturnType<typeof baseGiftStatusesService.getAll>>;
  gift_exchanges: Awaited<ReturnType<typeof baseGiftExchangesService.getAll>>;
}) {
  primeCachedResource("holiday-templates:list", data.holiday_templates, CACHE_TTL_MS.holiday);
  primeCachedResource("holidays:list", data.holidays, CACHE_TTL_MS.holidays);
  primeCachedResource("people:list", data.people, CACHE_TTL_MS.people);
  primeCachedResource("gift-statuses:list", data.gift_statuses, CACHE_TTL_MS.giftStatuses);
  primeCachedResource("gift-exchanges:list", data.gift_exchanges, CACHE_TTL_MS.exchanges);
}

async function loadBootstrap(force = false) {
  const now = Date.now();
  if (!force && bootstrapExpiresAt > now) {
    return;
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  const request = baseBootstrapService
    .get()
    .then((payload) => {
      if (bootstrapPromise !== request) return;
      seedShellCache(payload.data);
      bootstrapExpiresAt = Date.now() + BOOTSTRAP_TTL_MS;
    })
    .catch((error) => {
      if (bootstrapPromise === request) bootstrapExpiresAt = 0;
      throw error;
    })
    .finally(() => {
      if (bootstrapPromise === request) bootstrapPromise = null;
    });

  bootstrapPromise = request;
  return request;
}

async function readAppShellResource<T>(
  cacheKey: string,
  ttlMs: number,
  fetcher: () => Promise<T>
) {
  const generation = sessionGeneration;
  return readCachedResource(cacheKey, ttlMs, async () => {
    try {
      await loadBootstrap();
      if (generation !== sessionGeneration) throw new Error("Session changed");
      const seeded = peekCachedResource<T>(cacheKey);
      if (seeded !== undefined) {
        return seeded;
      }
    } catch {
      // Fall back to the dedicated endpoint when bootstrap is unavailable.
    }

    if (generation !== sessionGeneration) throw new Error("Session changed");
    return fetcher();
  });
}

function invalidateGiftCaches() {
  resetBootstrapState();
  invalidateCachedResources("gifts:");
  // Gift changes affect list totals and may move between holidays. Deletion
  // responses do not identify the old holiday, so expire all holiday summaries.
  invalidateCachedResources("holidays:");
  invalidateCachedResources("people:");
}

export const holidaysService = {
  getAll() {
    return readAppShellResource("holidays:list", CACHE_TTL_MS.holidays, () =>
      baseHolidaysService.getAll()
    );
  },

  getTemplates() {
    return readAppShellResource("holiday-templates:list", CACHE_TTL_MS.holiday, () =>
      baseHolidaysService.getTemplates()
    );
  },

  getById(id: number) {
    return readCachedResource(`holidays:${id}`, CACHE_TTL_MS.holiday, () =>
      baseHolidaysService.getById(id)
    );
  },

  async create(data: Parameters<typeof baseHolidaysService.create>[0]) {
    const holiday = await baseHolidaysService.create(data);
    resetBootstrapState();
    invalidateCachedResources("holidays:");
    invalidateCachedResources("gifts:");
    return holiday;
  },

  async update(id: number, data: Parameters<typeof baseHolidaysService.update>[1]) {
    const holiday = await baseHolidaysService.update(id, data);
    resetBootstrapState();
    invalidateCachedResources("holidays:");
    invalidateCachedResources("gifts:");
    return holiday;
  },

  async delete(id: number) {
    await baseHolidaysService.delete(id);
    resetBootstrapState();
    invalidateCachedResources("holidays:");
    invalidateCachedResources("gifts:");
    invalidateCachedResources("people:");
  },

  getShareLink(id: number) {
    return baseHolidaysService.getShareLink(id);
  },

  regenerateShareLink(id: number) {
    return baseHolidaysService.regenerateShareLink(id);
  },

  async join(shareToken: string) {
    const holiday = await baseHolidaysService.join(shareToken);
    resetBootstrapState();
    invalidateCachedResources("holidays:");
    invalidateCachedResources("gifts:");
    return holiday;
  },

  async leave(id: number) {
    await baseHolidaysService.leave(id);
    resetBootstrapState();
    invalidateCachedResources("holidays:");
    invalidateCachedResources("gifts:");
    invalidateCachedResources("people:");
  },

  getCollaborators(id: number) {
    return baseHolidaysService.getCollaborators(id);
  },

  async removeCollaborator(holidayId: number, userId: number) {
    await baseHolidaysService.removeCollaborator(holidayId, userId);
    resetBootstrapState();
    invalidateCachedResources("holidays:");
  },
};

export const giftsService = {
  getAll(options?: { holidayId?: number }) {
    const holidayId = options?.holidayId;
    const cacheKey = holidayId ? `gifts:list:${holidayId}` : "gifts:list:all";
    return readCachedResource(cacheKey, CACHE_TTL_MS.gifts, () => baseGiftsService.getAll(options));
  },

  getById(id: number) {
    return readCachedResource(`gifts:${id}`, CACHE_TTL_MS.gift, () => baseGiftsService.getById(id));
  },

  async create(data: Parameters<typeof baseGiftsService.create>[0]) {
    const gift = await baseGiftsService.create(data);
    invalidateGiftCaches();
    return gift;
  },

  async update(id: number, data: Parameters<typeof baseGiftsService.update>[1]) {
    const gift = await baseGiftsService.update(id, data);
    invalidateGiftCaches();
    invalidateCachedResources(`gifts:${id}`);
    return gift;
  },

  async delete(id: number) {
    await baseGiftsService.delete(id);
    invalidateGiftCaches();
    invalidateCachedResources(`gifts:${id}`);
  },

  async reorder(id: number, newPosition: number) {
    const gifts = await baseGiftsService.reorder(id, newPosition);
    invalidateGiftCaches();
    for (const gift of gifts) {
      invalidateCachedResources(`gifts:${gift.id}`);
    }
    return gifts;
  },

  async updateRecipientAddress(giftId: number, recipientId: number, shippingAddressId: number | null) {
    const gift = await baseGiftsService.updateRecipientAddress(giftId, recipientId, shippingAddressId);
    invalidateGiftCaches();
    invalidateCachedResources(`gifts:${giftId}`);
    return gift;
  },
};

export const giftStatusesService = {
  getAll() {
    return readAppShellResource("gift-statuses:list", CACHE_TTL_MS.giftStatuses, () =>
      baseGiftStatusesService.getAll()
    );
  },
};

export const peopleService = {
  getAll() {
    return readAppShellResource("people:list", CACHE_TTL_MS.people, () => basePeopleService.getAll());
  },

  getById(id: number) {
    return basePeopleService.getById(id);
  },

  async create(data: Parameters<typeof basePeopleService.create>[0]) {
    const person = await basePeopleService.create(data);
    resetBootstrapState();
    invalidateCachedResources("people:");
    return person;
  },

  async update(id: number, data: Parameters<typeof basePeopleService.update>[1]) {
    const person = await basePeopleService.update(id, data);
    invalidateGiftCaches();
    return person;
  },

  async delete(id: number) {
    await basePeopleService.delete(id);
    invalidateGiftCaches();
  },
};

export const giftExchangesService = {
  nudgeMatch(id: number) {
    return baseGiftExchangesService.nudgeMatch(id);
  },

  getAll() {
    // Another person can join or the organizer can draw while this app is open.
    // Focus and pull-to-refresh must see those changes immediately.
    return baseGiftExchangesService.getAll();
  },

  getById(id: number) {
    return baseGiftExchangesService.getBySlug(String(id));
  },

  async create(data: Parameters<typeof baseGiftExchangesService.create>[0]) {
    const exchange = await baseGiftExchangesService.create(data);
    resetBootstrapState();
    invalidateCachedResources("gift-exchanges:");
    return exchange;
  },

  async start(id: number) {
    const exchange = await baseGiftExchangesService.start(id);
    resetBootstrapState();
    invalidateCachedResources("gift-exchanges:");
    invalidateCachedResources(`gift-exchanges:${id}`);
    return exchange;
  },
};

export const exchangeJoinsService = {
  getDetails(shareToken: string) {
    return baseExchangeJoinsService.getDetails(shareToken);
  },

  async join(shareToken: string, name?: string) {
    const result = await baseExchangeJoinsService.join(shareToken, name);
    resetBootstrapState();
    invalidateCachedResources("gift-exchanges:");
    return result;
  },
};

export const exchangeParticipantsService = {
  async resendInvite(exchangeId: number, participantId: number) {
    await baseExchangeParticipantsService.resendInvite(exchangeId, participantId);
    resetBootstrapState();
    invalidateCachedResources("gift-exchanges:");
  },
  async create(exchangeId: number, data: Parameters<typeof baseExchangeParticipantsService.create>[1]) {
    const participant = await baseExchangeParticipantsService.create(exchangeId, data);
    resetBootstrapState();
    invalidateCachedResources("gift-exchanges:");
    return participant;
  },
};

export const exchangeExclusionsService = {
  getAll(exchangeId: number) {
    return baseExchangeExclusionsService.getAll(exchangeId);
  },

  async create(exchangeId: number, data: Parameters<typeof baseExchangeExclusionsService.create>[1]) {
    const exclusion = await baseExchangeExclusionsService.create(exchangeId, data);
    resetBootstrapState();
    invalidateCachedResources("gift-exchanges:");
    invalidateCachedResources(`gift-exchanges:${exchangeId}`);
    return exclusion;
  },

  async delete(exchangeId: number, exclusionId: number) {
    await baseExchangeExclusionsService.delete(exchangeId, exclusionId);
    resetBootstrapState();
    invalidateCachedResources("gift-exchanges:");
    invalidateCachedResources(`gift-exchanges:${exchangeId}`);
  },
};

export function prefetchAppShellData() {
  void loadBootstrap().catch(() => undefined);
}

export function clearCachedResources() {
  sessionGeneration += 1;
  resetBootstrapState();
  clearResourceCache();
}
