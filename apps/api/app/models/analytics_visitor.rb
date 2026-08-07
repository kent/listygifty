class AnalyticsVisitor < ApplicationRecord
  belongs_to :user, optional: true
  has_many :analytics_events, dependent: :delete_all

  validates :anonymous_id, presence: true, uniqueness: true, length: { maximum: 100 }
  validates :first_seen_at, :last_seen_at, presence: true
end
