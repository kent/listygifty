require "test_helper"

class Analytics::MetricServiceTest < ActiveSupport::TestCase
  def setup
    @service = Analytics::MetricService.new
    @visitor = AnalyticsVisitor.create!(
      anonymous_id: SecureRandom.uuid,
      first_seen_at: 2.days.ago,
      last_seen_at: Time.current,
      first_touch: {},
      last_touch: {}
    )
    create_event("page_viewed", 1.day.ago, session_id: "metric_session_first_123")
    create_event("page_viewed", Time.current, session_id: "metric_session_second_123")
    create_event("mobile_gift_idea_captured", Time.current, session_id: "metric_session_second_123")
  end

  test "returns filled database-grouped time series and accurate overall uniques" do
    result = @service.time_series(
      metric_key: "visitors",
      from: 1.day.ago.to_date,
      to: Date.current,
      granularity: "day"
    )

    assert_equal 1, result[:value]
    assert_equal [ 1, 1 ], result[:series].pluck(:value)

    sessions = @service.time_series(
      metric_key: "sessions",
      from: 1.day.ago.to_date,
      to: Date.current,
      granularity: "day"
    )
    assert_equal 2, sessions[:value]
  end

  test "supports named product-event and marketing-spend metrics" do
    events = @service.time_series(
      metric_key: "event_count",
      from: Date.current,
      to: Date.current,
      filters: { event_name: "mobile_gift_idea_captured" }
    )
    assert_equal 1, events[:value]

    MarketingSpend.create!(spend_date: Date.current, channel: "paid_search", source: "google", amount: 12.34)
    spend = @service.time_series(metric_key: "marketing_spend", from: Date.current, to: Date.current, filters: { currency: "USD" })
    assert_equal 12.34, spend[:value]
  end

  test "evaluates ordered funnel conversion in bounded weekly buckets" do
    result = @service.time_series(
      metric_key: "funnel_conversion_rate",
      from: 1.day.ago.to_date,
      to: Date.current,
      granularity: "week",
      funnel_steps: %w[page_viewed mobile_gift_idea_captured]
    )

    assert_equal 100.0, result[:value]
    assert_equal 1, result[:series].length
    assert_raises(ArgumentError) do
      @service.time_series(
        metric_key: "funnel_conversion_rate",
        from: Date.current,
        to: Date.current,
        granularity: "day",
        funnel_steps: %w[page_viewed mobile_gift_idea_captured]
      )
    end
  end

  test "excludes events before the requested start of a partial funnel bucket" do
    week_start = Date.new(2026, 8, 3)
    create_event("partial_funnel_started", week_start.noon, session_id: "partial_week_session_123")
    create_event("partial_funnel_finished", (week_start + 1.day).noon, session_id: "partial_week_session_123")

    result = @service.time_series(
      metric_key: "funnel_conversion_rate",
      from: week_start + 2.days,
      to: week_start + 4.days,
      granularity: "week",
      funnel_steps: %w[partial_funnel_started partial_funnel_finished]
    )

    assert_nil result.dig(:series, 0, :value)
    assert_equal 0, result.dig(:series, 0, :denominator)
    assert_nil result[:value]
  end

  private

  def create_event(name, occurred_at, session_id:)
    AnalyticsEvent.create!(
      event_id: SecureRandom.uuid,
      event_name: name,
      occurred_at: occurred_at,
      received_at: Time.current,
      analytics_visitor: @visitor,
      anonymous_id: @visitor.anonymous_id,
      session_id: session_id,
      platform: "web",
      channel: "direct"
    )
  end
end
