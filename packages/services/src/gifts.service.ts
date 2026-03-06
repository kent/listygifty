import type { ApiClient } from "@niftygifty/api-client";
import type { Gift, CreateGiftRequest, UpdateGiftRecipientRequest } from "@niftygifty/types";

export interface GiftsService {
  getAll(options?: { holidayId?: number }): Promise<Gift[]>;
  getById(id: number): Promise<Gift>;
  create(data: CreateGiftRequest["gift"]): Promise<Gift>;
  update(id: number, data: Partial<CreateGiftRequest["gift"]>): Promise<Gift>;
  delete(id: number): Promise<void>;
  reorder(id: number, newPosition: number): Promise<Gift[]>;
  updateRecipientAddress(giftId: number, recipientId: number, shippingAddressId: number | null): Promise<Gift>;
}

export function createGiftsService(client: ApiClient): GiftsService {
  return {
    getAll(options) {
      const holidayId = options?.holidayId;
      const endpoint = holidayId ? `/gifts?holiday_id=${holidayId}` : "/gifts";
      return client.get<Gift[]>(endpoint);
    },

    getById(id: number) {
      return client.get<Gift>(`/gifts/${id}`);
    },

    create(data: CreateGiftRequest["gift"]) {
      return client.post<Gift>("/gifts", { gift: data });
    },

    update(id: number, data: Partial<CreateGiftRequest["gift"]>) {
      return client.patch<Gift>(`/gifts/${id}`, { gift: data });
    },

    delete(id: number) {
      return client.delete(`/gifts/${id}`);
    },

    reorder(id: number, newPosition: number) {
      return client.patch<Gift[]>(`/gifts/${id}/reorder`, { position: newPosition });
    },

    updateRecipientAddress(giftId: number, recipientId: number, shippingAddressId: number | null) {
      return client.patch<Gift>(`/gifts/${giftId}/gift_recipients/${recipientId}`, {
        gift_recipient: { shipping_address_id: shippingAddressId },
      });
    },
  };
}
