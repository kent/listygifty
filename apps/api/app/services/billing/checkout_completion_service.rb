module Billing
  class CheckoutCompletionService
    EVENT_TYPE = "checkout.session.completed"

    def self.process!(event)
      raise ArgumentError, "Unexpected Stripe event type" unless event.type == EVENT_TYPE

      session = event.data.object
      metadata = session.metadata
      plan = metadata.plan.to_s
      config = PlanCatalog::PRICES[plan.to_sym]
      years = Integer(metadata.years)
      user_id = Integer(metadata.user_id)
      unless config && years == config[:years]
        raise ArgumentError, "Invalid checkout plan metadata"
      end
      unless session.payment_status == "paid"
        raise ArgumentError, "Checkout session has not been paid"
      end

      processed = false
      StripeWebhookEvent.transaction do
        receipt = StripeWebhookEvent.create_or_find_by!(stripe_checkout_session_id: session.id) do |record|
          record.stripe_event_id = event.id
          record.event_type = event.type
        end
        next unless receipt.previously_new_record?

        user = User.lock.find(user_id)
        base_date = user.premium? ? user.subscription_expires_at : Time.current
        user.activate_premium!(expires_at: base_date + years.years)
        processed = true
      end
      processed
    end
  end
end
