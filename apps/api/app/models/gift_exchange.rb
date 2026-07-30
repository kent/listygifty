class GiftExchange < ApplicationRecord
  STATUSES = %w[draft inviting active completed].freeze

  belongs_to :user
  belongs_to :workspace
  has_many :exchange_participants, dependent: :destroy
  has_many :users, through: :exchange_participants
  has_many :exchange_exclusions, dependent: :destroy

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

  def can_start?
    status == "inviting" && all_accepted? && exchange_participants.count >= 3
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
