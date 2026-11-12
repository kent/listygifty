import { apiClient } from "@/lib/api-client";
import type { WishlistAccessRequest } from "@niftygifty/types";

// Asking someone in an exchange to see their wishlist, and answering when
// someone asks you.
class WishlistAccessRequestsService {
  private base(exchangeId: number): string {
    return `/gift_exchanges/${exchangeId}/wishlist_access_requests`;
  }

  async create(exchangeId: number, participantId: number): Promise<WishlistAccessRequest> {
    return apiClient.post<WishlistAccessRequest>(this.base(exchangeId), { participant_id: participantId });
  }

  async approve(exchangeId: number, requestId: number): Promise<WishlistAccessRequest> {
    return apiClient.post<WishlistAccessRequest>(`${this.base(exchangeId)}/${requestId}/approve`);
  }

  async deny(exchangeId: number, requestId: number): Promise<WishlistAccessRequest> {
    return apiClient.post<WishlistAccessRequest>(`${this.base(exchangeId)}/${requestId}/deny`);
  }
}

export const wishlistAccessRequestsService = new WishlistAccessRequestsService();
