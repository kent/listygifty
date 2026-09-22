class GiftStatus < ApplicationRecord
  has_many :gifts, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: true
  validates :position, presence: true

  # NOTE: Explicitly use `by_position` scope where ordering is needed
  # Avoid default_scope as it causes unexpected behavior in joins/associations
  scope :by_position, -> { order(:position) }

  # Use the same completion rule as the shared web/mobile summaries.
  def self.completed_ids
    statuses = by_position.to_a
    completed = if statuses.length > 1
      statuses.select { |status| status.position == statuses.last.position }
    else
      statuses.select { |status| status.name.match?(/complete|delivered|done|received|shipped|wrapped/i) }
    end
    completed.map(&:id)
  end
end
