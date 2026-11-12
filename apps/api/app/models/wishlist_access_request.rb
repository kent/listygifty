# One person in an exchange asking to see another's wishlist. The person asked
# answers once, yes or no.
class WishlistAccessRequest < ApplicationRecord
  STATUSES = %w[pending approved denied].freeze

  belongs_to :gift_exchange
  belongs_to :requester_participant, class_name: "ExchangeParticipant", inverse_of: :sent_wishlist_access_requests
  belongs_to :requested_participant, class_name: "ExchangeParticipant", inverse_of: :received_wishlist_access_requests
  has_many :exchange_notifications, dependent: :delete_all

  validates :status, inclusion: { in: STATUSES }
  validate :participants_share_exchange

  def pending?
    status == "pending"
  end

  private

  def participants_share_exchange
    return if requester_participant.nil? || requested_participant.nil?

    if requester_participant_id == requested_participant_id
      errors.add(:requested_participant, "can't be the person asking")
    elsif [ requester_participant, requested_participant ].any? { |participant| participant.gift_exchange_id != gift_exchange_id }
      errors.add(:requested_participant, "must be in the same exchange")
    end
  end
end
