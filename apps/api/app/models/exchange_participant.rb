class ExchangeParticipant < ApplicationRecord
  STATUSES = %w[invited accepted declined].freeze
  ANONYMIZED_NAME = "Former member".freeze
  # .invalid is reserved (RFC 2606), so this can never reach a real mailbox.
  ANONYMIZED_EMAIL_DOMAIN = "deleted.invalid".freeze

  belongs_to :gift_exchange
  belongs_to :user, optional: true
  belongs_to :wishlist, optional: true
  belongs_to :matched_participant,
    class_name: "ExchangeParticipant",
    optional: true,
    inverse_of: :matched_by_participants
  has_many :matched_by_participants,
    class_name: "ExchangeParticipant",
    foreign_key: :matched_participant_id,
    dependent: :nullify,
    inverse_of: :matched_participant
  # Their own wishlist, the same list every exchange they're in can use.
  has_many :wishlist_items, -> { active.ordered }, through: :wishlist
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
  validates :phone, format: { with: PhoneNumber::E164, message: "doesn't look like a phone number" }, allow_nil: true
  validate :wishlist_owned_by_user

  before_validation :generate_invite_token, on: :create
  before_validation :normalize_phone
  before_save :forget_text_consent

  scope :invited, -> { where(status: "invited") }
  scope :accepted, -> { where(status: "accepted") }
  scope :declined, -> { where(status: "declined") }
  scope :anonymized, -> { where("email LIKE ?", "%@#{ANONYMIZED_EMAIL_DOMAIN}") }

  def anonymized?
    email.to_s.end_with?("@#{ANONYMIZED_EMAIL_DOMAIN}")
  end

  # True once a draw depends on this row, either way round.
  def in_draw?
    matched_participant_id.present? || matched_by_participants.exists?
  end

  # For someone who deleted their account while a draw depends on their row.
  # The row stays so the draw holds, and everything that identifies them goes.
  # Declined keeps them out of redraws and out of every email, and the new
  # token kills any invite link still sitting in an inbox.
  def anonymize!
    exchange_notifications.destroy_all
    update!(
      user: nil,
      wishlist: nil,
      name: anonymized_name,
      email: "deleted-#{id}@#{ANONYMIZED_EMAIL_DOMAIN}",
      phone: nil,
      status: "declined",
      invite_token: SecureRandom.urlsafe_base64(32)
    )
  end

  def accept!(accepting_user)
    chosen = wishlist if wishlist&.user_id == accepting_user.id
    update!(user: accepting_user, status: "accepted", wishlist: chosen || accepting_user.default_wishlist!)
  end

  # The wishlist this exchange shows, linking the person's default one the
  # first time it's needed.
  def wishlist!
    return wishlist if wishlist

    if user.nil?
      errors.add(:wishlist, "needs an account")
      raise ActiveRecord::RecordInvalid, self
    end

    with_lock do
      update!(wishlist: user.default_wishlist!) unless wishlist
      wishlist
    end
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

  def nudged_recently?
    last_nudged_at.present? && last_nudged_at > ExchangeNudgeService::COOLDOWN.ago
  end

  # Someone the organizer invited who hasn't answered, and wasn't nudged in
  # the last day.
  def nudgeable?
    status == "invited" && gift_exchange.editable? && !nudged_recently?
  end

  # The organizer confirmed this person said it's OK to text this number.
  def textable?
    phone.present? && text_consent_at.present?
  end

  private

  # The giver still has to recognize who they drew, so a first name stays. It
  # comes from the row, never the account, and join links can store an email
  # address as the name, which must not survive.
  def anonymized_name
    first_word = name.to_s.split.first
    first_word.nil? || first_word.include?("@") ? ANONYMIZED_NAME : first_word
  end

  def wishlist_owned_by_user
    return if wishlist.nil? || wishlist.user_id == user_id

    errors.add(:wishlist, "must be one of your own wishlists")
  end

  def normalize_phone
    self.phone = PhoneNumber.normalize(phone)
  end

  # Consent covers one number. A new number needs the organizer to confirm
  # again, unless they're confirming it in the same save.
  def forget_text_consent
    return unless phone.blank? || (will_save_change_to_phone? && !will_save_change_to_text_consent_at?)

    self.text_consent_at = nil
  end

  def generate_invite_token
    self.invite_token ||= SecureRandom.urlsafe_base64(32)
  end
end
