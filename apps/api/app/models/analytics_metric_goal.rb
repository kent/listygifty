class AnalyticsMetricGoal < ApplicationRecord
  METRIC_KEYS = %w[
    visitors sessions pageviews signups activated_users paid_users
    visitor_to_signup_rate signup_to_activation_rate event_count
    funnel_conversion_rate marketing_spend
  ].freeze
  COMPARISON_OPERATORS = %w[gte lte].freeze
  GRANULARITIES = %w[day week month].freeze
  STATUSES = %w[active paused achieved archived].freeze
  FILTER_KEYS = %w[channel source campaign platform event_name currency].freeze

  belongs_to :created_by, class_name: "User", optional: true

  validates :name, :metric_key, :target_value, :comparison_operator, :start_date, :target_date, :granularity, :status, presence: true
  validates :name, length: { maximum: 200 }
  validates :notes, length: { maximum: 5_000 }, allow_nil: true
  validates :metric_key, inclusion: { in: METRIC_KEYS }
  validates :comparison_operator, inclusion: { in: COMPARISON_OPERATORS }
  validates :granularity, inclusion: { in: GRANULARITIES }
  validates :status, inclusion: { in: STATUSES }
  validates :target_value, numericality: { greater_than_or_equal_to: 0 }
  validate :target_date_not_before_start_date
  validate :bounded_window
  validate :supported_filters
  validate :metric_configuration

  scope :current, -> { where(status: %w[active paused]) }

  private

  def target_date_not_before_start_date
    return if start_date.blank? || target_date.blank? || target_date >= start_date

    errors.add(:target_date, "must be on or after the start date")
  end

  def bounded_window
    return if start_date.blank? || target_date.blank? || (target_date - start_date).to_i <= 365

    errors.add(:target_date, "must be within 366 days of the start date")
  end

  def supported_filters
    values = filters.to_h.stringify_keys
    unknown = values.keys - FILTER_KEYS
    errors.add(:filters, "contain unsupported keys: #{unknown.join(', ')}") if unknown.any?
    errors.add(:filters, "must use scalar values of 200 characters or fewer") unless values.values.all? { |value| value.is_a?(String) && value.length <= 200 }
  end

  def metric_configuration
    if metric_key == "event_count" && filters.to_h["event_name"].blank?
      errors.add(:filters, "must include event_name for event_count goals")
    end

    if metric_key == "funnel_conversion_rate"
      errors.add(:funnel_steps, "must contain between 2 and 10 event names") unless funnel_steps.is_a?(Array) && funnel_steps.length.between?(2, 10)
      if funnel_steps.is_a?(Array) && !funnel_steps.all? { |step| step.to_s.match?(/\A[a-z][a-z0-9_]{0,79}\z/) }
        errors.add(:funnel_steps, "contain an invalid event name")
      end
      errors.add(:granularity, "must be week or month for funnel conversion goals") if granularity == "day"
    elsif funnel_steps.present?
      errors.add(:funnel_steps, "are only supported for funnel conversion goals")
    end

    if metric_key.to_s.end_with?("_rate") && target_value.present? && !target_value.between?(0, 100)
      errors.add(:target_value, "must be between 0 and 100 for rate goals")
    end
    if metric_key == "marketing_spend"
      unsupported = filters.to_h.stringify_keys.keys - %w[channel source campaign currency]
      errors.add(:filters, "contain unsupported spend keys: #{unsupported.join(', ')}") if unsupported.any?
      errors.add(:filters, "must include currency for marketing_spend goals") if filters.to_h["currency"].blank?
    elsif filters.to_h.stringify_keys.key?("currency")
      errors.add(:filters, "currency is only supported for marketing_spend goals")
    end
  end
end
