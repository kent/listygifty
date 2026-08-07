require "test_helper"

class Billing::CheckoutCompletionServiceTest < ActiveSupport::TestCase
  self.use_transactional_tests = false

  setup do
    @user = User.create!(
      email: "billing-#{SecureRandom.hex(6)}@example.com",
      clerk_user_id: "billing_#{SecureRandom.hex(8)}",
      subscription_plan: "free"
    )
  end

  teardown do
    StripeWebhookEvent.where(stripe_checkout_session_id: @session_ids).delete_all if @session_ids
    @user&.destroy!
  end

  test "sequential duplicate delivery grants a checkout session exactly once" do
    stripe_event = event(id: "evt_duplicate", session_id: "cs_duplicate", plan: "yearly", years: 1)

    travel_to Time.zone.parse("2026-08-08 12:00:00") do
      assert Billing::CheckoutCompletionService.process!(stripe_event)
      first_expiration = @user.reload.subscription_expires_at
      assert_not Billing::CheckoutCompletionService.process!(stripe_event)
      assert_equal first_expiration, @user.reload.subscription_expires_at
      assert_equal 1, StripeWebhookEvent.where(stripe_checkout_session_id: "cs_duplicate").count
    end
  end

  test "concurrent duplicate deliveries grant once" do
    stripe_event = event(id: "evt_concurrent_duplicate", session_id: "cs_concurrent_duplicate", plan: "yearly", years: 1)

    run_concurrently(stripe_event, stripe_event)

    assert_in_delta 1.year.from_now.to_f, @user.reload.subscription_expires_at.to_f, 5
    assert_equal 1, StripeWebhookEvent.where(stripe_checkout_session_id: "cs_concurrent_duplicate").count
  end

  test "concurrent distinct paid sessions compose their terms under the user lock" do
    first = event(id: "evt_one_year", session_id: "cs_one_year", plan: "yearly", years: 1)
    second = event(id: "evt_two_year", session_id: "cs_two_year", plan: "two_year", years: 2)

    run_concurrently(first, second)

    assert_in_delta 3.years.from_now.to_f, @user.reload.subscription_expires_at.to_f, 5
    assert_equal 2, StripeWebhookEvent.where(stripe_checkout_session_id: %w[cs_one_year cs_two_year]).count
  end

  private

  def event(id:, session_id:, plan:, years:)
    @session_ids ||= []
    @session_ids << session_id
    Stripe::Event.construct_from(
      id: id,
      type: "checkout.session.completed",
      data: {
        object: {
          id: session_id,
          payment_status: "paid",
          metadata: { user_id: @user.id.to_s, plan: plan, years: years.to_s }
        }
      }
    )
  end

  def run_concurrently(*events)
    ready = Queue.new
    start = Queue.new
    errors = Queue.new
    threads = events.map do |stripe_event|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          ready << true
          start.pop
          Billing::CheckoutCompletionService.process!(stripe_event)
        rescue StandardError => e
          errors << e
        end
      end
    end
    events.length.times { ready.pop }
    events.length.times { start << true }
    threads.each(&:join)
    raise errors.pop unless errors.empty?
  end
end
