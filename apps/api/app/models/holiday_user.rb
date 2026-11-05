class HolidayUser < ApplicationRecord
  enum :role, { owner: "owner", collaborator: "collaborator" }, default: :collaborator

  # How this member hears about gifts other people add to the list:
  # instant emails them shortly after, daily leaves it to the daily digest,
  # off sends nothing about this list.
  GIFT_NOTIFICATIONS = %w[instant daily off].freeze

  belongs_to :holiday
  belongs_to :user

  validates :user_id, uniqueness: { scope: :holiday_id }
  validates :gift_notifications, inclusion: { in: GIFT_NOTIFICATIONS }
end
