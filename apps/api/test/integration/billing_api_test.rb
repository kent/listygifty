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

  test "create_checkout_session rejects invalid plan" do
    post "/billing/create_checkout_session",
      headers: @auth_headers,
      params: { plan: "invalid" },
      as: :json

    assert_response :unprocessable_entity
    assert_equal "Invalid plan", json_response["error"]
  end

  test "create_checkout_session rejects non-string plans" do
    [ 123, [], { unexpected: "yearly" } ].each do |plan|
      post "/billing/create_checkout_session", headers: @auth_headers, params: { plan: plan }, as: :json
      assert_response :unprocessable_entity
      assert_equal "Invalid plan", json_response["error"]
    end
  end

  test "create_checkout_session requires plan" do
    post "/billing/create_checkout_session",
      headers: @auth_headers,
      params: {},
      as: :json

    assert_response :unprocessable_entity
    assert_equal "Invalid plan", json_response["error"]
  end

  # ============================================================================
  # Coupon Tests
  # ============================================================================

  test "redeem_coupon is unavailable outside development" do
    post "/billing/redeem_coupon",
      headers: @auth_headers,
      params: { code: "HOHOHO" },
      as: :json
    assert_response :forbidden
  end

  test "redeem_coupon without a code remains unavailable outside development" do
    post "/billing/redeem_coupon",
      headers: @auth_headers,
      params: {},
      as: :json
    assert_response :forbidden
  end

  # ============================================================================
  # Authentication Tests
  # ============================================================================

  test "billing endpoints require authentication" do
    get "/billing/status", as: :json
    assert_response :unauthorized
  end

  test "webhook records a paid Stripe event and ignores sequential retries" do
    stripe_event = Stripe::Event.construct_from(
      id: "evt_billing_api_duplicate",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_billing_api_duplicate",
          payment_status: "paid",
          metadata: { user_id: @user.id.to_s, plan: "yearly", years: "1" }
        }
      }
    )

    payload = stripe_event.to_json
    timestamp = Time.current.to_i
    secret = "whsec_test_billing"
    signature = OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{payload}")
    previous_secret = ENV["STRIPE_WEBHOOK_SECRET"]
    ENV["STRIPE_WEBHOOK_SECRET"] = secret
    2.times do
      post "/billing/webhook",
        params: payload,
        headers: {
          "Content-Type" => "application/json",
          "Stripe-Signature" => "t=#{timestamp},v1=#{signature}"
        }
      assert_response :success
    end
  ensure
    ENV["STRIPE_WEBHOOK_SECRET"] = previous_secret
    assert_in_delta 1.year.from_now.to_f, @user.reload.subscription_expires_at.to_f, 5
    assert_equal 1, StripeWebhookEvent.where(stripe_event_id: stripe_event.id).count
  end

  test "webhook endpoint is public" do
    # Webhook doesn't require auth but needs valid signature
    # This tests that it doesn't return unauthorized
    post "/billing/webhook",
      params: { type: "test" },
      headers: { "Stripe-Signature" => "invalid_sig" },
      as: :json
    assert_response :bad_request
  end
end
