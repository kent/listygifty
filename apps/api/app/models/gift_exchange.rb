class GiftExchange < ApplicationRecord
  STATUSES = %w[draft inviting active completed].freeze
  MIN_PARTICIPANTS = 2

  belongs_to :user
  belongs_to :workspace
  has_many :exchange_participants, dependent: :destroy
  has_many :users, through: :exchange_participants
  has_many :exchange_exclusions, dependent: :destroy
  has_many :exchange_notifications, dependent: :destroy

  has_secure_token :share_token

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :budget_min, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :budget_max, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validate :budget_max_greater_than_min

  before_validation :assign_slug, if: :should_assign_slug?

  scope :owned_by, ->(user) { where(user: user) }
  scope :participating, ->(user) { joins(:exchange_participants).where(exchange_participants: { user: user }) }
  scope :for_user, ->(user) {
    where(id: owned_by(user).select(:id))
      .or(where(id: participating(user).select(:id)))
      .distinct
  }

  def owner?(check_user)
    user_id == check_user.id
  end

  def participant_for(check_user)
    exchange_participants.find_by(user: check_user)
  end

  def all_accepted?
    exchange_participants.where.not(status: "accepted").empty?
  end

  def can_publish?
    status == "inviting" && exchange_participants.accepted.count >= MIN_PARTICIPANTS
  end

  def editable?
    %w[draft inviting].include?(status)
  end

  # The share link joins people while the roster is still open; it dies at
  # publish and revives if the exchange is reopened.
  alias_method :join_open?, :editable?

  def share_url
    "#{ENV.fetch("FRONTEND_URL", "https://listygifty.com")}/e/#{slug}/#{share_token}"
  end

  alias_method :can_start?, :can_publish?

  def role_for(check_user)
    return "organizer" if owner?(check_user)
    return nil unless participant_for(check_user)

    %w[active completed].include?(status) ? "giver" : "participant"
  end

  def roles_for(check_user)
    roles = []
    roles.concat(%w[owner organizer]) if owner?(check_user)
    participant = participant_for(check_user)
    roles << "participant" if participant
    roles << "matcher" if participant&.matched_participant_id.present? && %w[active completed].include?(status)
    roles
  end

  def capabilities_for(check_user)
    participant = participant_for(check_user)
    {
      organize: owner?(check_user),
      participate: participant.present?,
      view_match: participant&.matched_participant_id.present? && %w[active completed].include?(status),
      nudge_match: participant&.matched_participant_id.present? && %w[active completed].include?(status),
      publish: owner?(check_user) && can_publish?,
      redo: owner?(check_user) && %w[active completed].include?(status),
      delete: owner?(check_user)
    }
  end

  private

  def should_assign_slug?
    slug.blank? || will_save_change_to_name?
  end

  def assign_slug
    base = name.to_s.parameterize.presence || "exchange"
    base = base.first(240)
    candidate = base
    suffix = 2

    while GiftExchange.where.not(id: id).exists?(slug: candidate)
      suffix_text = "-#{suffix}"
      candidate = "#{base.first(255 - suffix_text.length)}#{suffix_text}"
      suffix += 1
    end

    self.slug = candidate
  end

  def budget_max_greater_than_min
    return if budget_min.blank? || budget_max.blank?
    errors.add(:budget_max, "must be greater than or equal to minimum budget") if budget_max < budget_min
  end
end
