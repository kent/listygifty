import { apiClient } from "@/lib/api-client";
import type {
  WishlistItem,
  CreateWishlistItemRequest,
  UpdateWishlistItemRequest,
} from "@niftygifty/types";

class WishlistItemsService {
  private buildUrl(exchangeId: number, participantId: number, itemId?: number): string {
    const base = `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/exchange_wishlist_items`;
    return itemId ? `${base}/${itemId}` : base;
  }

  async getAll(exchangeId: number, participantId: number): Promise<WishlistItem[]> {
    return apiClient.get<WishlistItem[]>(this.buildUrl(exchangeId, participantId));
  }

  async getById(exchangeId: number, participantId: number, itemId: number): Promise<WishlistItem> {
    return apiClient.get<WishlistItem>(this.buildUrl(exchangeId, participantId, itemId));
  }

  async create(
    exchangeId: number,
    participantId: number,
    data: CreateWishlistItemRequest["wishlist_item"]
  ): Promise<WishlistItem> {
    return apiClient.post<WishlistItem>(
      this.buildUrl(exchangeId, participantId),
      { wishlist_item: data }
    );
  }

  async update(
    exchangeId: number,
    participantId: number,
    itemId: number,
    data: UpdateWishlistItemRequest["wishlist_item"]
  ): Promise<WishlistItem> {
    return apiClient.patch<WishlistItem>(
      this.buildUrl(exchangeId, participantId, itemId),
      { wishlist_item: data }
    );
  }

  async delete(exchangeId: number, participantId: number, itemId: number): Promise<void> {
    return apiClient.delete(this.buildUrl(exchangeId, participantId, itemId));
  }

  // Upload photo using FormData
  async uploadPhoto(
    exchangeId: number,
    participantId: number,
    itemId: number,
    file: File
  ): Promise<WishlistItem> {
    const formData = new FormData();
    formData.append("wishlist_item[photo]", file);

    return apiClient.patchFormData<WishlistItem>(
      this.buildUrl(exchangeId, participantId, itemId),
      formData
    );
  }
}

export const wishlistItemsService = new WishlistItemsService();
