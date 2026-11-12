import type { ApiClient } from "@niftygifty/api-client";
import type { WishlistAccessRequest } from "@niftygifty/types";

// Asking someone in an exchange to see their wishlist, and answering when
// someone asks you.
export interface WishlistAccessRequestsService {
  create(exchangeId: number, participantId: number): Promise<WishlistAccessRequest>;
  approve(exchangeId: number, requestId: number): Promise<WishlistAccessRequest>;
  deny(exchangeId: number, requestId: number): Promise<WishlistAccessRequest>;
}

export function createWishlistAccessRequestsService(client: ApiClient): WishlistAccessRequestsService {
  const base = (exchangeId: number) => `/gift_exchanges/${exchangeId}/wishlist_access_requests`;

  return {
    create(exchangeId, participantId) {
      return client.post<WishlistAccessRequest>(base(exchangeId), { participant_id: participantId });
    },
    approve(exchangeId, requestId) {
      return client.post<WishlistAccessRequest>(`${base(exchangeId)}/${requestId}/approve`);
    },
    deny(exchangeId, requestId) {
      return client.post<WishlistAccessRequest>(`${base(exchangeId)}/${requestId}/deny`);
    },
  };
}
