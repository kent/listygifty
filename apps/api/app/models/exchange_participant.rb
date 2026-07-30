class ExchangeParticipant < ApplicationRecord
  STATUSES = %w[invited accepted declined].freeze

  belongs_to :gift_exchange
  belongs_to :user, optional: true
  belongs_to :matched_participant,
    class_name: "ExchangeParticipant",
    optional: true,
    inverse_of: :matched_by_participants
  has_many :matched_by_participants,
    class_name: "ExchangeParticipant",
    foreign_key: :matched_participant_id,
    dependent: :nullify,
    inverse_of: :matched_participant
  has_many :exchange_wishlist_items, dependent: :destroy
  has_many :exclusions_as_a, class_name: "ExchangeExclusion", foreign_key: :participant_a_id, dependent: :destroy
  has_many :exclusions_as_b, class_name: "ExchangeExclusion", foreign_key: :participant_b_id, dependent: :destroy
  has_many :exchange_notifications,
    foreign_key: :recipient_participant_id,
    dependent: :destroy,
    inverse_of: :recipient_participant

  validates :name, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :invite_token, presence: true, uniqueness: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :email, uniqueness: { scope: :gift_exchange_id, message: "is already a participant" }

  before_validation :generate_invite_token, on: :create

  scope :invited, -> { where(status: "invited") }
  scope :accepted, -> { where(status: "accepted") }
  scope :declined, -> { where(status: "declined") }

  def accept!(accepting_user)
    update!(user: accepting_user, status: "accepted")
  end

  def decline!
    update!(status: "declined")
  end

  def display_name
    user&.first_name.presence || name
  end

  # The exchange address is the address the organizer invited and the
  # participant accepted. A Clerk-backed user can temporarily have a synthetic
  # `@clerk.user` fallback address, so user.email is not safe for delivery.
  def delivery_email
    email
  end

  def excluded_from?(other_participant)
    ExchangeExclusion.exists_between?(self, other_participant)
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.urlsafe_base64(32)
  end
end
