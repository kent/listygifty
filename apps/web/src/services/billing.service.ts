import { apiClient } from "@/lib/api-client";
import type {
  BillingStatus,
  BillingPlan,
  CheckoutSessionResponse,
  CouponRedemptionResponse,
} from "@niftygifty/types";

class BillingService {
  async getStatus(): Promise<BillingStatus> {
    return apiClient.get<BillingStatus>("/billing/status");
  }

  async createCheckoutSession(plan: BillingPlan): Promise<CheckoutSessionResponse> {
    return apiClient.post<CheckoutSessionResponse>("/billing/create_checkout_session", { plan });
  }

  // Redirect to Stripe checkout
  async checkout(plan: BillingPlan): Promise<void> {
    const { checkout_url } = await this.createCheckoutSession(plan);
    window.location.href = checkout_url;
  }

  // Redeem a coupon code (dev mode only)
  async redeemCoupon(code: string): Promise<CouponRedemptionResponse> {
    return apiClient.post<CouponRedemptionResponse>("/billing/redeem_coupon", { code });
  }
}

export const billingService = new BillingService();
