class ExchangeNotification < ApplicationRecord
  KINDS = %w[wishlist_item_added wishlist_nudge].freeze

  belongs_to :gift_exchange
  belongs_to :recipient_participant, class_name: "ExchangeParticipant"
  belongs_to :wishlist_item, optional: true

  validates :kind, presence: true, inclusion: { in: KINDS }
  validate :participant_belongs_to_exchange
  # A notice stays valid after the owner points the exchange at another list.
  validate :wishlist_item_belongs_to_exchange, on: :create

  scope :unread, -> { where(read_at: nil) }
  scope :recent_first, -> { order(created_at: :desc) }

  def read?
    read_at.present?
  end

  def mark_read!
    update!(read_at: Time.current) unless read?
    self
  end

  private

  def participant_belongs_to_exchange
    return if recipient_participant.nil? || recipient_participant.gift_exchange_id == gift_exchange_id

    errors.add(:recipient_participant, "must belong to this exchange")
  end

  def wishlist_item_belongs_to_exchange
    return if wishlist_item.nil?
    return if gift_exchange&.exchange_participants&.exists?(wishlist_id: wishlist_item.wishlist_id)

    errors.add(:wishlist_item, "must belong to this exchange")
  end
end
