require "test_helper"

class AnalyticsMetricGoalTest < ActiveSupport::TestCase
  test "validates bounded goal and metric configuration" do
    goal = AnalyticsMetricGoal.new(
      name: "Signup conversion",
      metric_key: "funnel_conversion_rate",
      target_value: 120,
      start_date: Date.current,
      target_date: 2.years.from_now.to_date,
      granularity: "day",
      filters: { "unknown" => "value" },
      funnel_steps: [ "Invalid Event" ]
    )

    assert_not goal.valid?
    assert goal.errors[:target_date].any?
    assert goal.errors[:filters].any?
    assert goal.errors[:funnel_steps].any?
    assert goal.errors[:granularity].any?
    assert goal.errors[:target_value].any?
  end

  test "requires an event name for product-event goals" do
    goal = AnalyticsMetricGoal.new(
      name: "Gift captures",
      metric_key: "event_count",
      target_value: 100,
      start_date: Date.current,
      target_date: 1.month.from_now.to_date,
      filters: {}
    )

    assert_not goal.valid?
    assert_includes goal.errors[:filters], "must include event_name for event_count goals"
  end
end
