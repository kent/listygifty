import type { ApiClient } from "@niftygifty/api-client";
import type {
  WishlistItem,
  CreateWishlistItemRequest,
  UpdateWishlistItemRequest,
} from "@niftygifty/types";

export interface WishlistItemsService {
  getAll(exchangeId: number, participantId: number): Promise<WishlistItem[]>;
  getById(exchangeId: number, participantId: number, itemId: number): Promise<WishlistItem>;
  create(
    exchangeId: number,
    participantId: number,
    data: CreateWishlistItemRequest["wishlist_item"]
  ): Promise<WishlistItem>;
  update(
    exchangeId: number,
    participantId: number,
    itemId: number,
    data: UpdateWishlistItemRequest["wishlist_item"]
  ): Promise<WishlistItem>;
  delete(exchangeId: number, participantId: number, itemId: number): Promise<void>;
  reorder(exchangeId: number, participantId: number, itemIds: number[]): Promise<WishlistItem[]>;
  /** Mark an item on a list you can see as reserved, or bought. */
  claim(exchangeId: number, participantId: number, itemId: number, purchased?: boolean): Promise<WishlistItem>;
  markPurchased(exchangeId: number, participantId: number, itemId: number): Promise<WishlistItem>;
  unclaim(exchangeId: number, participantId: number, itemId: number): Promise<WishlistItem>;
  uploadPhoto(
    exchangeId: number,
    participantId: number,
    itemId: number,
    formData: FormData
  ): Promise<WishlistItem>;
}

export function createWishlistItemsService(client: ApiClient): WishlistItemsService {
  function buildUrl(exchangeId: number, participantId: number, itemId?: number): string {
    const base = `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/exchange_wishlist_items`;
    return itemId ? `${base}/${itemId}` : base;
  }

  return {
    getAll(exchangeId: number, participantId: number) {
      return client.get<WishlistItem[]>(buildUrl(exchangeId, participantId));
    },

    getById(exchangeId: number, participantId: number, itemId: number) {
      return client.get<WishlistItem>(buildUrl(exchangeId, participantId, itemId));
    },

    create(
      exchangeId: number,
      participantId: number,
      data: CreateWishlistItemRequest["wishlist_item"]
    ) {
      return client.post<WishlistItem>(buildUrl(exchangeId, participantId), {
        wishlist_item: data,
      });
    },

    update(
      exchangeId: number,
      participantId: number,
      itemId: number,
      data: UpdateWishlistItemRequest["wishlist_item"]
    ) {
      return client.patch<WishlistItem>(buildUrl(exchangeId, participantId, itemId), {
        wishlist_item: data,
      });
    },

    delete(exchangeId: number, participantId: number, itemId: number) {
      return client.delete(buildUrl(exchangeId, participantId, itemId));
    },

    reorder(exchangeId: number, participantId: number, itemIds: number[]) {
      return client.patch<WishlistItem[]>(`${buildUrl(exchangeId, participantId)}/reorder`, {
        item_ids: itemIds,
      });
    },

    claim(exchangeId: number, participantId: number, itemId: number, purchased = false) {
      return client.post<WishlistItem>(`${buildUrl(exchangeId, participantId, itemId)}/claim`, { purchased });
    },

    markPurchased(exchangeId: number, participantId: number, itemId: number) {
      return client.patch<WishlistItem>(`${buildUrl(exchangeId, participantId, itemId)}/mark_purchased`, {});
    },

    unclaim(exchangeId: number, participantId: number, itemId: number) {
      return client.delete<WishlistItem>(`${buildUrl(exchangeId, participantId, itemId)}/unclaim`);
    },

    async uploadPhoto(
      exchangeId: number,
      participantId: number,
      itemId: number,
      formData: FormData
    ) {
      return client.patchFormData<WishlistItem>(buildUrl(exchangeId, participantId, itemId), formData);
    },
  };
}
