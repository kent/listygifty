class Gift < ApplicationRecord
  belongs_to :holiday
  belongs_to :gift_status
  belongs_to :created_by, class_name: "User", foreign_key: "created_by_user_id", optional: true
  has_many :gift_recipients, dependent: :destroy
  has_many :recipients, through: :gift_recipients, source: :person
  has_many :gift_givers, dependent: :destroy
  has_many :givers, through: :gift_givers, source: :person
  has_many :gift_changes, dependent: :destroy
  has_many :match_slots, dependent: :destroy

  validates :name, presence: true, length: { maximum: 500 }
  validates :description, length: { maximum: 5_000 }, allow_blank: true
  validates :link, length: { maximum: 2_048 }, allow_blank: true

  # NOTE: Explicitly use `by_position` scope where ordering is needed
  # Avoid default_scope as it causes unexpected behavior in joins/associations
  scope :by_position, -> { order(:position) }

  before_create :set_position
  before_create :set_created_by
  after_create :track_creation
  after_update :track_update

  # Reorder gifts within a holiday - updates positions for all affected gifts
  def self.reorder_within_holiday(holiday_id, gift_id, new_position)
    transaction do
      gift = find(gift_id)
      old_position = gift.position

      return if old_position == new_position

      if new_position > old_position
        # Moving down: shift items between old and new position up
        where(holiday_id: holiday_id)
          .where("position > ? AND position <= ?", old_position, new_position)
          .update_all("position = position - 1")
      else
        # Moving up: shift items between new and old position down
        where(holiday_id: holiday_id)
          .where("position >= ? AND position < ?", new_position, old_position)
          .update_all("position = position + 1")
      end

      gift.update_column(:position, new_position)
    end
  end

  private

  def track_creation
    return unless Current.user && holiday.holiday_users.where.not(user: Current.user).exists?

    GiftChange.create!(
      gift: self,
      holiday: holiday,
      user: Current.user,
      change_type: :created,
      changes_data: { name: name, description: description, cost: cost&.to_f }
    )
  end

  def track_update
    return unless Current.user && holiday.holiday_users.where.not(user: Current.user).exists?
    return if saved_changes.keys == [ "updated_at" ] || saved_changes.keys == [ "position", "updated_at" ]

    tracked_attrs = %w[name description cost link gift_status_id]
    relevant_changes = saved_changes.slice(*tracked_attrs)
    return if relevant_changes.empty?

    GiftChange.create!(
      gift: self,
      holiday: holiday,
      user: Current.user,
      change_type: :updated,
      changes_data: relevant_changes
    )
  end

  def set_position
    # Default behavior: new gifts appear at the top (position 0).
    # If a position is provided, insert at that position (clamped to >= 0).
    desired_position = position.nil? ? 0 : position.to_i
    desired_position = 0 if desired_position.negative?

    self.position = desired_position

    # Shift existing items down to make room (including current top at 0).
    Gift.where(holiday_id: holiday_id)
        .where("position >= ?", desired_position)
        .update_all("position = position + 1")
  end

  def set_created_by
    self.created_by_user_id ||= Current.user&.id
  end
end
