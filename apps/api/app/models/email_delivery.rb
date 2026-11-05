class EmailDelivery < ApplicationRecord
  KINDS = %w[pending_gifts no_gifts_before_christmas no_gift_lists_december digest organizer_wishlist_reminder].freeze
  STATUSES = %w[sent failed].freeze

  belongs_to :user
  belongs_to :holiday, optional: true

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :to_email, presence: true
  validates :subject, presence: true
  validates :dedupe_key, presence: true
  validates :sent_at, presence: true

  scope :by_kind, ->(kind) { where(kind: kind) }
  scope :by_user, ->(user) { where(user: user) }
  scope :sent, -> { where(status: "sent") }
  scope :failed, -> { where(status: "failed") }
  scope :recent, -> { order(sent_at: :desc) }
  scope :since, ->(time) { where("sent_at >= ?", time) }

  # Check if an email of this kind was sent to this user within the cadence window
  def self.sent_within?(user:, kind:, days:)
    by_user(user).by_kind(kind).sent.since(days.days.ago).exists?
  end

  # Log a successful delivery
  def self.log_sent!(user:, kind:, subject:, dedupe_key:, holiday: nil, metadata: {})
    create!(
      user: user,
      holiday: holiday,
      kind: kind,
      to_email: user.email,
      subject: subject,
      sent_at: Time.current,
      status: "sent",
      dedupe_key: dedupe_key,
      metadata: metadata
    )
  end

  # Log a failed delivery
  def self.log_failed!(user:, kind:, subject:, dedupe_key:, error:, holiday: nil, metadata: {})
    create!(
      user: user,
      holiday: holiday,
      kind: kind,
      to_email: user.email,
      subject: subject,
      sent_at: Time.current,
      status: "failed",
      error: error,
      dedupe_key: dedupe_key,
      metadata: metadata
    )
  end
end
