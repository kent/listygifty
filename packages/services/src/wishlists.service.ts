import type { ApiClient } from "@niftygifty/api-client";
import {
  WISHLIST_API_ENDPOINTS,
  type Wishlist,
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

export interface WishlistsService {
  // Wishlists
  getAll(): Promise<Wishlist[]>;
  getById(id: number): Promise<WishlistWithItems>;
  create(data: CreateWishlistRequest["wishlist"]): Promise<Wishlist>;
  update(id: number, data: UpdateWishlistRequest["wishlist"]): Promise<Wishlist>;
  delete(id: number): Promise<void>;
  share(id: number): Promise<ShareWishlistResponse>;
  revokeShare(id: number): Promise<{ message: string; visibility: string }>;

  // Items
  getItems(wishlistId: number): Promise<StandaloneWishlistItem[]>;
  createItem(wishlistId: number, data: CreateStandaloneWishlistItemRequest["wishlist_item"]): Promise<StandaloneWishlistItem>;
  updateItem(wishlistId: number, itemId: number, data: UpdateStandaloneWishlistItemRequest["wishlist_item"]): Promise<StandaloneWishlistItem>;
  deleteItem(wishlistId: number, itemId: number): Promise<void>;
  reorderItems(wishlistId: number, positions: Record<number, number>): Promise<StandaloneWishlistItem[]>;

  // Claims (authenticated)
  claimItem(wishlistId: number, itemId: number, quantity?: number, purchased?: boolean): Promise<WishlistItemClaim>;
  unclaimItem(wishlistId: number, itemId: number): Promise<void>;
  markPurchased(wishlistId: number, itemId: number): Promise<WishlistItemClaim>;

  // Public (no auth)
  getPublicWishlist(token: string): Promise<WishlistWithItems>;
  publicClaimItem(token: string, itemId: number, data: GuestClaimRequest["claim"]): Promise<GuestClaimResponse>;

  // Guest claim management (no auth)
  getGuestClaim(token: string): Promise<GuestClaimDetailsResponse>;
  updateGuestClaim(token: string, data: UpdateGuestClaimRequest["claim"]): Promise<WishlistItemClaim>;
  deleteGuestClaim(token: string): Promise<{ message: string }>;
}

export function createWishlistsService(client: ApiClient): WishlistsService {
  return {
    // Wishlists
    getAll() {
      return client.get<Wishlist[]>(WISHLIST_API_ENDPOINTS.wishlists);
    },

    getById(id: number) {
      return client.get<WishlistWithItems>(WISHLIST_API_ENDPOINTS.wishlist(id));
    },

    create(data: CreateWishlistRequest["wishlist"]) {
      return client.post<Wishlist>(WISHLIST_API_ENDPOINTS.wishlists, { wishlist: data });
    },

    update(id: number, data: UpdateWishlistRequest["wishlist"]) {
      return client.patch<Wishlist>(WISHLIST_API_ENDPOINTS.wishlist(id), { wishlist: data });
    },

    delete(id: number) {
      return client.delete(WISHLIST_API_ENDPOINTS.wishlist(id));
    },

    share(id: number) {
      return client.post<ShareWishlistResponse>(WISHLIST_API_ENDPOINTS.shareWishlist(id));
    },

    revokeShare(id: number) {
      return client.delete<{ message: string; visibility: string }>(WISHLIST_API_ENDPOINTS.revokeShare(id));
    },

    // Items
    getItems(wishlistId: number) {
      return client.get<StandaloneWishlistItem[]>(WISHLIST_API_ENDPOINTS.wishlistItems(wishlistId));
    },

    createItem(wishlistId: number, data: CreateStandaloneWishlistItemRequest["wishlist_item"]) {
      return client.post<StandaloneWishlistItem>(WISHLIST_API_ENDPOINTS.wishlistItems(wishlistId), {
        wishlist_item: data,
      });
    },

    updateItem(wishlistId: number, itemId: number, data: UpdateStandaloneWishlistItemRequest["wishlist_item"]) {
      return client.patch<StandaloneWishlistItem>(WISHLIST_API_ENDPOINTS.wishlistItem(wishlistId, itemId), {
        wishlist_item: data,
      });
    },

    deleteItem(wishlistId: number, itemId: number) {
      return client.delete(WISHLIST_API_ENDPOINTS.wishlistItem(wishlistId, itemId));
    },

    reorderItems(wishlistId: number, positions: Record<number, number>) {
      return client.patch<StandaloneWishlistItem[]>(WISHLIST_API_ENDPOINTS.reorderItems(wishlistId), {
        positions,
      });
    },

    // Claims (authenticated)
    claimItem(wishlistId: number, itemId: number, quantity?: number, purchased?: boolean) {
      return client.post<WishlistItemClaim>(WISHLIST_API_ENDPOINTS.claimItem(wishlistId, itemId), {
        quantity,
        purchased,
      });
    },

    unclaimItem(wishlistId: number, itemId: number) {
      return client.delete(WISHLIST_API_ENDPOINTS.unclaimItem(wishlistId, itemId));
    },

    markPurchased(wishlistId: number, itemId: number) {
      return client.patch<WishlistItemClaim>(WISHLIST_API_ENDPOINTS.markPurchased(wishlistId, itemId));
    },

    // Public (no auth)
    getPublicWishlist(token: string) {
      return client.get<WishlistWithItems>(WISHLIST_API_ENDPOINTS.publicWishlist(token));
    },

    publicClaimItem(token: string, itemId: number, data: GuestClaimRequest["claim"]) {
      return client.post<GuestClaimResponse>(WISHLIST_API_ENDPOINTS.publicClaimItem(token, itemId), {
        claim: data,
      });
    },

    // Guest claim management (no auth)
    getGuestClaim(token: string) {
      return client.get<GuestClaimDetailsResponse>(WISHLIST_API_ENDPOINTS.guestClaim(token));
    },

    updateGuestClaim(token: string, data: UpdateGuestClaimRequest["claim"]) {
      return client.patch<WishlistItemClaim>(WISHLIST_API_ENDPOINTS.guestClaim(token), {
        claim: data,
      });
    },

    deleteGuestClaim(token: string) {
      return client.delete<{ message: string }>(WISHLIST_API_ENDPOINTS.guestClaim(token));
    },
  };
}
