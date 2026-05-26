class BillingController < ApplicationController
  skip_before_action :authenticate!, only: [ :webhook ]
  skip_before_action :verify_authenticity_token, only: [ :webhook ], raise: false

  PRICES = {
    yearly: { amount: 2500, currency: "cad", interval: "year", years: 1 },
    two_year: { amount: 4000, currency: "cad", interval: "year", years: 2 }
  }.freeze

  # GET /billing/status
  def status
    render json: {
      subscription_plan: current_user.subscription_plan,
      subscription_status: current_user.subscription_status,
      subscription_expires_at: current_user.subscription_expires_at,
      gift_count: current_user.gift_count,
      gifts_remaining: current_user.gifts_remaining,
      can_create_gift: current_user.can_create_gift?,
      free_limit: User::FREE_GIFT_LIMIT
    }
  end

  # POST /billing/create_checkout_session
  def create_checkout_session
    plan = params[:plan]&.to_sym
    price_config = PRICES[plan]

    unless price_config
      return render json: { error: "Invalid plan" }, status: :unprocessable_entity
    end

    # Create or retrieve Stripe customer
    customer = find_or_create_stripe_customer

    session = Stripe::Checkout::Session.create(
      customer: customer.id,
      payment_method_types: [ "card" ],
      line_items: [ {
        price_data: {
          currency: price_config[:currency],
          product_data: {
            name: plan == :yearly ? "Listy Gifty Premium (1 Year)" : "Listy Gifty Premium (2 Years)",
            description: "Unlimited gift tracking • $0.068 CAD/day"
          },
          unit_amount: price_config[:amount]
        },
        quantity: 1
      } ],
      mode: "payment",
      success_url: "#{frontend_url}/billing/thank-you?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "#{frontend_url}/billing?canceled=true",
      metadata: {
        user_id: current_user.id,
        plan: plan.to_s,
        years: price_config[:years]
      }
    )

    render json: { checkout_url: session.url, session_id: session.id }
  end

  # POST /billing/redeem_coupon (dev only)
  def redeem_coupon
    unless Rails.env.development?
      return render json: { error: "Coupons only available in development" }, status: :forbidden
    end

    code = params[:code]&.upcase

    case code
    when "HOHOHO"
      current_user.activate_premium!(expires_at: 1.year.from_now)
      render json: {
        success: true,
        message: "🎅 Ho Ho Ho! Merry Christmas! Premium unlocked!",
        animation: "christmas",
        subscription_expires_at: current_user.subscription_expires_at
      }
    else
      render json: { error: "Invalid coupon code" }, status: :unprocessable_entity
    end
  end

  # POST /billing/webhook
  def webhook
    payload = request.body.read
    sig_header = request.env["HTTP_STRIPE_SIGNATURE"]

    begin
      event = Stripe::Webhook.construct_event(
        payload, sig_header, stripe_webhook_secret
      )
    rescue JSON::ParserError
      return head :bad_request
    rescue Stripe::SignatureVerificationError
      return head :bad_request
    end

    case event.type
    when "checkout.session.completed"
      handle_checkout_completed(event.data.object)
    end

    head :ok
  end

  private

  def find_or_create_stripe_customer
    if current_user.stripe_customer_id.present?
      Stripe::Customer.retrieve(current_user.stripe_customer_id)
    else
      customer = Stripe::Customer.create(
        email: current_user.email,
        metadata: { user_id: current_user.id }
      )
      current_user.update!(stripe_customer_id: customer.id)
      customer
    end
  end

  def handle_checkout_completed(session)
    user_id = session.metadata.user_id
    years = session.metadata.years.to_i
    user = User.find(user_id)

    # Calculate expiration from current expiration (if active) or now
    base_date = user.premium? ? user.subscription_expires_at : Time.current
    expires_at = base_date + years.years

    user.activate_premium!(expires_at: expires_at)
  end

  def frontend_url
    ENV.fetch("FRONTEND_URL", "http://localhost:3000")
  end

  def stripe_webhook_secret
    Rails.application.credentials.dig(:stripe, :webhook_secret) || ENV["STRIPE_WEBHOOK_SECRET"]
  end
end
