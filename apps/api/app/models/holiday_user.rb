class HolidayUser < ApplicationRecord
  enum :role, { owner: "owner", collaborator: "collaborator" }, default: :collaborator

  # Existing memberships may still store "instant". They now use the daily digest.
  GIFT_NOTIFICATIONS = %w[instant daily off].freeze

  belongs_to :holiday
  belongs_to :user

  validates :user_id, uniqueness: { scope: :holiday_id }
  validates :gift_notifications, inclusion: { in: GIFT_NOTIFICATIONS }

  def self.normalize_gift_notifications(value)
    value == "instant" ? "daily" : value
  end
end
