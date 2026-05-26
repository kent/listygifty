import type { ApiClient } from "@niftygifty/api-client";
import type {
  CreateGiftExchangeRequest,
  GiftExchange,
  GiftExchangeWithParticipants,
} from "@niftygifty/types";

export interface GiftExchangesService {
  getAll(): Promise<GiftExchange[]>;
  getById(id: number): Promise<GiftExchangeWithParticipants>;
  create(data: CreateGiftExchangeRequest["gift_exchange"]): Promise<GiftExchange>;
  start(id: number): Promise<GiftExchangeWithParticipants>;
}

export function createGiftExchangesService(client: ApiClient): GiftExchangesService {
  return {
    getAll() {
      return client.get<GiftExchange[]>("/gift_exchanges");
    },

    getById(id: number) {
      return client.get<GiftExchangeWithParticipants>(`/gift_exchanges/${id}`);
    },

    create(data: CreateGiftExchangeRequest["gift_exchange"]) {
      return client.post<GiftExchange>("/gift_exchanges", { gift_exchange: data });
    },

    start(id: number) {
      return client.post<GiftExchangeWithParticipants>(`/gift_exchanges/${id}/start`);
    },
  };
}
