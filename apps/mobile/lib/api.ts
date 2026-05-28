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
  exchange: 30_000,
} as const;

// Create the API client instance
export const apiClient = new ApiClient({
  baseUrl: API_URL,
  debug: __DEV__,
});

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

let bootstrapPromise: Promise<void> | null = null;
let bootstrapExpiresAt = 0;

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

  bootstrapPromise = baseBootstrapService
    .get()
    .then((payload) => {
      seedShellCache(payload.data);
      bootstrapExpiresAt = Date.now() + BOOTSTRAP_TTL_MS;
    })
    .catch((error) => {
      bootstrapExpiresAt = 0;
      throw error;
    })
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
}

async function readAppShellResource<T>(
  cacheKey: string,
  ttlMs: number,
  fetcher: () => Promise<T>
) {
  return readCachedResource(cacheKey, ttlMs, async () => {
    try {
      await loadBootstrap();
      const seeded = peekCachedResource<T>(cacheKey);
      if (seeded !== undefined) {
        return seeded;
      }
    } catch {
      // Fall back to the dedicated endpoint when bootstrap is unavailable.
    }

    return fetcher();
  });
}

function invalidateGiftCaches(holidayId?: number | null) {
  resetBootstrapState();
  invalidateCachedResources("gifts:");
  if (holidayId) {
    invalidateCachedResources(`holidays:${holidayId}`);
  }
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
    invalidateGiftCaches(gift.holiday_id);
    return gift;
  },

  async update(id: number, data: Parameters<typeof baseGiftsService.update>[1]) {
    const gift = await baseGiftsService.update(id, data);
    invalidateGiftCaches(gift.holiday_id);
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
    const holidayId = gifts[0]?.holiday_id;
    invalidateGiftCaches(holidayId);
    for (const gift of gifts) {
      invalidateCachedResources(`gifts:${gift.id}`);
    }
    return gifts;
  },

  async updateRecipientAddress(giftId: number, recipientId: number, shippingAddressId: number | null) {
    const gift = await baseGiftsService.updateRecipientAddress(giftId, recipientId, shippingAddressId);
    invalidateGiftCaches(gift.holiday_id);
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
    resetBootstrapState();
    invalidateCachedResources("people:");
    return person;
  },

  async delete(id: number) {
    await basePeopleService.delete(id);
    resetBootstrapState();
    invalidateCachedResources("people:");
  },
};

export const giftExchangesService = {
  getAll() {
    return readAppShellResource("gift-exchanges:list", CACHE_TTL_MS.exchanges, () =>
      baseGiftExchangesService.getAll()
    );
  },

  getById(id: number) {
    return readCachedResource(`gift-exchanges:${id}`, CACHE_TTL_MS.exchange, () =>
      baseGiftExchangesService.getById(id)
    );
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

export const exchangeParticipantsService = {
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
  resetBootstrapState();
  clearResourceCache();
}
