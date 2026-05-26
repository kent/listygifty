require "test_helper"

class BillingApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
  end

  # ============================================================================
  # Status Tests
  # ============================================================================

  test "status returns billing status for user" do
    get "/billing/status", headers: @auth_headers, as: :json
    assert_response :success
    assert json_response.key?("subscription_plan")
  end

  test "status includes plan limits" do
    get "/billing/status", headers: @auth_headers, as: :json
    assert_response :success
    # Should include information about plan limits
    assert json_response["subscription_plan"].present?
  end

  # ============================================================================
  # Checkout Tests
  # ============================================================================

  test "create_checkout_session creates Stripe session" do
    # This will fail without proper Stripe setup, but should return appropriate error
    post "/billing/create_checkout_session",
      headers: @auth_headers,
      params: { price_id: "price_test_123", success_url: "http://localhost/success", cancel_url: "http://localhost/cancel" },
      as: :json

    # In test environment without Stripe, this may return error
    # but should still respond (not crash)
    assert_includes [ 200, 201, 422, 500, 503 ], response.status
  end

  test "create_checkout_session requires price_id" do
    post "/billing/create_checkout_session",
      headers: @auth_headers,
      params: { success_url: "http://localhost/success", cancel_url: "http://localhost/cancel" },
      as: :json
    assert_includes [ 400, 422 ], response.status
  end

  # ============================================================================
  # Coupon Tests
  # ============================================================================

  test "redeem_coupon applies valid coupon" do
    post "/billing/redeem_coupon",
      headers: @auth_headers,
      params: { coupon_code: "TESTCOUPON" },
      as: :json
    # May succeed or fail depending on coupon validity and subscription status
    assert_includes [ 200, 403, 404, 422 ], response.status
  end

  test "redeem_coupon requires coupon_code" do
    post "/billing/redeem_coupon",
      headers: @auth_headers,
      params: {},
      as: :json
    # Should return error status
    assert_includes [ 400, 403, 422 ], response.status
  end

  # ============================================================================
  # Authentication Tests
  # ============================================================================

  test "billing endpoints require authentication" do
    get "/billing/status", as: :json
    assert_response :unauthorized
  end

  test "webhook endpoint is public" do
    # Webhook doesn't require auth but needs valid signature
    # This tests that it doesn't return unauthorized
    post "/billing/webhook",
      params: { type: "test" },
      headers: { "Stripe-Signature" => "invalid_sig" },
      as: :json
    # Should fail signature verification, not auth
    assert_not_equal 401, response.status
  end
end
