import { apiClient } from "@/lib/api-client";
import type {
  GiftExchange,
  GiftExchangeWithParticipants,
  CreateGiftExchangeRequest,
  UpdateGiftExchangeRequest,
} from "@niftygifty/types";

class GiftExchangesService {
  async getAll(): Promise<GiftExchange[]> {
    return apiClient.get<GiftExchange[]>("/gift_exchanges");
  }

  async getBySlug(slug: string): Promise<GiftExchangeWithParticipants> {
    return apiClient.get<GiftExchangeWithParticipants>(`/gift_exchanges/${slug}`);
  }

  async create(data: CreateGiftExchangeRequest["gift_exchange"]): Promise<GiftExchange> {
    return apiClient.post<GiftExchange>("/gift_exchanges", { gift_exchange: data });
  }

  async update(id: number, data: UpdateGiftExchangeRequest["gift_exchange"]): Promise<GiftExchange> {
    return apiClient.patch<GiftExchange>(`/gift_exchanges/${id}`, { gift_exchange: data });
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete(`/gift_exchanges/${id}`);
  }

  async start(id: number): Promise<GiftExchangeWithParticipants> {
    return apiClient.post<GiftExchangeWithParticipants>(`/gift_exchanges/${id}/start`);
  }

  async publish(id: number): Promise<GiftExchangeWithParticipants> {
    return apiClient.post<GiftExchangeWithParticipants>(`/gift_exchanges/${id}/publish`);
  }

  async redo(id: number, mode: "reopen" | "redraw"): Promise<GiftExchangeWithParticipants> {
    return apiClient.post<GiftExchangeWithParticipants>(`/gift_exchanges/${id}/redo`, { mode });
  }

  async nudgeMatch(id: number): Promise<void> {
    return apiClient.post(`/gift_exchanges/${id}/nudge_match`);
  }
}

export const giftExchangesService = new GiftExchangesService();
