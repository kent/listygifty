import type { ApiClient } from "@niftygifty/api-client";
import type {
  CreateGiftExchangeRequest,
  GiftExchange,
  GiftExchangeWithParticipants,
} from "@niftygifty/types";

export interface GiftExchangesService {
  getAll(): Promise<GiftExchange[]>;
  getBySlug(slug: string): Promise<GiftExchangeWithParticipants>;
  create(data: CreateGiftExchangeRequest["gift_exchange"]): Promise<GiftExchange>;
  start(id: number): Promise<GiftExchangeWithParticipants>;
  redo(id: number, mode: "reopen" | "redraw"): Promise<GiftExchangeWithParticipants>;
}

export function createGiftExchangesService(client: ApiClient): GiftExchangesService {
  return {
    getAll() {
      return client.get<GiftExchange[]>("/gift_exchanges");
    },

    getBySlug(slug: string) {
      return client.get<GiftExchangeWithParticipants>(`/gift_exchanges/${slug}`);
    },

    create(data: CreateGiftExchangeRequest["gift_exchange"]) {
      return client.post<GiftExchange>("/gift_exchanges", { gift_exchange: data });
    },

    start(id: number) {
      return client.post<GiftExchangeWithParticipants>(`/gift_exchanges/${id}/start`);
    },

    redo(id: number, mode: "reopen" | "redraw") {
      return client.post<GiftExchangeWithParticipants>(`/gift_exchanges/${id}/redo`, { mode });
    },
  };
}
