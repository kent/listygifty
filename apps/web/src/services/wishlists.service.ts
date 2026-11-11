import { apiClient } from "@/lib/api-client";
import {
  WISHLIST_API_ENDPOINTS,
  type Wishlist,
  type WishlistVisibility,
  type WishlistWithItems,
  type CreateWishlistRequest,
  type UpdateWishlistRequest,
  type ShareWishlistResponse,
  type StandaloneWishlistItem,
  type CreateStandaloneWishlistItemRequest,
  type UpdateStandaloneWishlistItemRequest,
  type WishlistItemClaim,
  type GuestClaimRequest,
  type GuestClaimResponse,
  type GuestClaimDetailsResponse,
  type UpdateGuestClaimRequest,
} from "@niftygifty/types";

class WishlistsService {
  // Wishlists
  async getAll(): Promise<Wishlist[]> {
    return apiClient.get<Wishlist[]>(WISHLIST_API_ENDPOINTS.wishlists);
  }

  async getById(id: number): Promise<WishlistWithItems> {
    return apiClient.get<WishlistWithItems>(WISHLIST_API_ENDPOINTS.wishlist(id));
  }

  async create(data: CreateWishlistRequest["wishlist"]): Promise<Wishlist> {
    return apiClient.post<Wishlist>(WISHLIST_API_ENDPOINTS.wishlists, { wishlist: data });
  }

  async update(id: number, data: UpdateWishlistRequest["wishlist"]): Promise<Wishlist> {
    return apiClient.patch<Wishlist>(WISHLIST_API_ENDPOINTS.wishlist(id), { wishlist: data });
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete(WISHLIST_API_ENDPOINTS.wishlist(id));
  }

  async share(id: number): Promise<ShareWishlistResponse> {
    return apiClient.post<ShareWishlistResponse>(WISHLIST_API_ENDPOINTS.shareWishlist(id));
  }

  async revokeShare(id: number): Promise<{ message: string; visibility: WishlistVisibility }> {
    return apiClient.delete<{ message: string; visibility: WishlistVisibility }>(WISHLIST_API_ENDPOINTS.revokeShare(id));
  }

  // Items
  async getItems(wishlistId: number): Promise<StandaloneWishlistItem[]> {
    return apiClient.get<StandaloneWishlistItem[]>(WISHLIST_API_ENDPOINTS.wishlistItems(wishlistId));
  }

  async createItem(
    wishlistId: number,
    data: CreateStandaloneWishlistItemRequest["wishlist_item"]
  ): Promise<StandaloneWishlistItem> {
    return apiClient.post<StandaloneWishlistItem>(WISHLIST_API_ENDPOINTS.wishlistItems(wishlistId), {
      wishlist_item: data,
    });
  }

  async updateItem(
    wishlistId: number,
    itemId: number,
    data: UpdateStandaloneWishlistItemRequest["wishlist_item"]
  ): Promise<StandaloneWishlistItem> {
    return apiClient.patch<StandaloneWishlistItem>(WISHLIST_API_ENDPOINTS.wishlistItem(wishlistId, itemId), {
      wishlist_item: data,
    });
  }

  async deleteItem(wishlistId: number, itemId: number): Promise<void> {
    return apiClient.delete(WISHLIST_API_ENDPOINTS.wishlistItem(wishlistId, itemId));
  }

  async reorderItems(wishlistId: number, positions: Record<number, number>): Promise<StandaloneWishlistItem[]> {
    return apiClient.patch<StandaloneWishlistItem[]>(WISHLIST_API_ENDPOINTS.reorderItems(wishlistId), {
      positions,
    });
  }

  // Claims (authenticated)
  async claimItem(
    wishlistId: number,
    itemId: number,
    quantity?: number,
    purchased?: boolean
  ): Promise<WishlistItemClaim> {
    return apiClient.post<WishlistItemClaim>(WISHLIST_API_ENDPOINTS.claimItem(wishlistId, itemId), {
      quantity,
      purchased,
    });
  }

  async unclaimItem(wishlistId: number, itemId: number): Promise<void> {
    return apiClient.delete(WISHLIST_API_ENDPOINTS.unclaimItem(wishlistId, itemId));
  }

  async markPurchased(wishlistId: number, itemId: number): Promise<WishlistItemClaim> {
    return apiClient.patch<WishlistItemClaim>(WISHLIST_API_ENDPOINTS.markPurchased(wishlistId, itemId));
  }

  // Public (no auth needed - these work without authentication)
  async getPublicWishlist(token: string): Promise<WishlistWithItems> {
    return apiClient.get<WishlistWithItems>(WISHLIST_API_ENDPOINTS.publicWishlist(token));
  }

  async publicClaimItem(
    token: string,
    itemId: number,
    data: GuestClaimRequest["claim"]
  ): Promise<GuestClaimResponse> {
    return apiClient.post<GuestClaimResponse>(WISHLIST_API_ENDPOINTS.publicClaimItem(token, itemId), {
      claim: data,
    });
  }

  // Guest claim management (no auth needed)
  async getGuestClaim(token: string): Promise<GuestClaimDetailsResponse> {
    return apiClient.get<GuestClaimDetailsResponse>(WISHLIST_API_ENDPOINTS.guestClaim(token));
  }

  async updateGuestClaim(token: string, data: UpdateGuestClaimRequest["claim"]): Promise<WishlistItemClaim> {
    return apiClient.patch<WishlistItemClaim>(WISHLIST_API_ENDPOINTS.guestClaim(token), {
      claim: data,
    });
  }

  async deleteGuestClaim(token: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(WISHLIST_API_ENDPOINTS.guestClaim(token));
  }
}

export const wishlistsService = new WishlistsService();
