require "test_helper"

class Analytics::GoalServiceTest < ActiveSupport::TestCase
  test "does not declare cumulative lte goals achieved before their deadline" do
    start_date = Date.new(2026, 8, 1)
    target_date = Date.new(2026, 8, 10)
    goal = AnalyticsMetricGoal.create!(
      name: "Keep pageviews below the test ceiling",
      metric_key: "pageviews",
      target_value: 10,
      comparison_operator: "lte",
      start_date: start_date,
      target_date: target_date,
      granularity: "day",
      status: "active"
    )
    service = Analytics::GoalService.new(actor: users(:one))

    travel_to(start_date.noon) do
      evaluation = service.evaluate(id: goal.id).sole.fetch(:evaluation)
      assert_equal "on_track", evaluation[:state]
      assert evaluation[:threshold_met]
      assert_not evaluation[:achieved]
    end

    travel_to(target_date.noon) do
      evaluation = service.evaluate(id: goal.id).sole.fetch(:evaluation)
      assert_equal "on_track", evaluation[:state]
      assert_not evaluation[:achieved]
    end

    travel_to((target_date + 1.day).noon) do
      evaluation = service.evaluate(id: goal.id).sole.fetch(:evaluation)
      assert_equal "achieved", evaluation[:state]
      assert evaluation[:achieved]
    end
  end

  test "marks an lte goal missed at its deadline when the ceiling is exceeded" do
    visitor = AnalyticsVisitor.create!(
      anonymous_id: SecureRandom.uuid,
      first_seen_at: Date.new(2026, 8, 1).noon,
      last_seen_at: Date.new(2026, 8, 2).noon,
      first_touch: {},
      last_touch: {}
    )
    AnalyticsEvent.create!(
      event_id: SecureRandom.uuid,
      event_name: "page_viewed",
      occurred_at: Date.new(2026, 8, 2).noon,
      received_at: Date.new(2026, 8, 2).noon,
      analytics_visitor: visitor,
      anonymous_id: visitor.anonymous_id,
      session_id: SecureRandom.uuid,
      platform: "web",
      channel: "direct"
    )
    goal = AnalyticsMetricGoal.create!(
      name: "Zero test pageviews",
      metric_key: "pageviews",
      target_value: 0,
      comparison_operator: "lte",
      start_date: Date.new(2026, 8, 1),
      target_date: Date.new(2026, 8, 10),
      granularity: "day",
      status: "active"
    )

    travel_to(Date.new(2026, 8, 11).noon) do
      evaluation = Analytics::GoalService.new(actor: users(:one)).evaluate(id: goal.id).sole.fetch(:evaluation)
      assert_equal "missed", evaluation[:state]
      assert_not evaluation[:threshold_met]
      assert_not evaluation[:achieved]
    end
  end
end
