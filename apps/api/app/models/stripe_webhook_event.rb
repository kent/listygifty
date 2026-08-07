class StripeWebhookEvent < ApplicationRecord
  validates :stripe_event_id, presence: true, length: { maximum: 255 }
  validates :stripe_checkout_session_id, presence: true, length: { maximum: 255 }
  validates :event_type, presence: true, length: { maximum: 100 }
end
