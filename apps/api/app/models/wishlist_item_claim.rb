class WishlistItemClaim < ApplicationRecord
  STATUSES = %w[reserved purchased].freeze

  belongs_to :wishlist_item
  belongs_to :user, optional: true

  has_secure_token :claim_token

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :quantity, numericality: { greater_than: 0 }
  validates :claimer_email, length: { maximum: 254 }, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :claimer_name, length: { maximum: 200 }, allow_blank: true
  validates :message, length: { maximum: 2_000 }, allow_blank: true
  validate :user_or_guest_present
  validate :quantity_available, on: :create

  before_validation :set_claimed_at, on: :create
  before_validation :normalize_claimer_email

  scope :by_user, ->(user) { where(user: user) }
  scope :by_guest_email, ->(email) { where(claimer_email: email.downcase) }
  scope :reserved, -> { where(status: "reserved") }
  scope :purchased, -> { where(status: "purchased") }
  scope :revealed, -> { where.not(revealed_at: nil) }
  scope :unrevealed, -> { where(revealed_at: nil) }

  delegate :wishlist, to: :wishlist_item

  def guest?
    user_id.nil?
  end

  def claimer_display_name
    guest? ? claimer_name : user.safe_name
  end

  def mark_purchased!
    update!(status: "purchased", purchased_at: Time.current)
  end

  def reveal!
    update!(revealed_at: Time.current)
  end

  def revealed?
    revealed_at.present?
  end

  def reserved?
    status == "reserved"
  end

  def purchased?
    status == "purchased"
  end

  private

  def user_or_guest_present
    if user_id.blank? && claimer_email.blank?
      errors.add(:base, "Must have either a user or guest email")
    end
  end

  def quantity_available
    return unless wishlist_item

    if quantity > wishlist_item.available_quantity
      errors.add(:quantity, "exceeds available quantity (#{wishlist_item.available_quantity} available)")
    end
  end

  def set_claimed_at
    self.claimed_at ||= Time.current
  end

  def normalize_claimer_email
    self.claimer_email = claimer_email.downcase.strip if claimer_email.present?
  end
end
