class AnalyticsEvent < ApplicationRecord
  PLATFORMS = %w[web ios android unknown].freeze

  belongs_to :analytics_visitor
  belongs_to :user, optional: true
  belongs_to :workspace, optional: true

  validates :event_id, :event_name, :occurred_at, :received_at, :anonymous_id, :session_id, presence: true
  validates :event_id, uniqueness: true
  validates :event_name, format: { with: /\A[a-z][a-z0-9_]*\z/ }, length: { maximum: 80 }
  validates :anonymous_id, :session_id, length: { maximum: 100 }
  validates :platform, inclusion: { in: PLATFORMS }

  scope :occurred_between, ->(from, to) { where(occurred_at: from..to) }
end
