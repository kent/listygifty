require "test_helper"

class AdminAnalyticsMcpTest < ActionDispatch::IntegrationTest
  def setup
    @admin = User.create!(email: Admin::Authorization::DEFAULT_ADMIN_EMAIL, clerk_user_id: "analytics_admin", subscription_plan: "free")
    @key = ApiKey.generate_for(@admin, name: "Analytics Admin", scopes: [ "admin" ])
    @visitor = AnalyticsVisitor.create!(
      anonymous_id: SecureRandom.uuid,
      first_seen_at: 1.day.ago,
      last_seen_at: Time.current,
      first_channel: "organic_search",
      last_channel: "organic_search",
      first_landing_page: "/",
      last_landing_page: "/",
      first_touch: { "utm_source" => "google" },
      last_touch: { "utm_source" => "google" }
    )
    create_event("page_viewed", 2.hours.ago)
    create_event("homepage_cta_clicked", 1.hour.ago)
  end

  test "lists and runs marketing analytics tools" do
    post_mcp("tools/list")
    names = json_response.dig("result", "tools").pluck("name")
    assert_includes names, "admin_analytics_overview"
    assert_includes names, "admin_analytics_acquisition"
    assert_includes names, "admin_analytics_funnel"
    assert_includes names, "admin_analytics_retention"
    assert_includes names, "admin_upsert_marketing_spend"
    assert_includes names, "admin_analytics_timeseries"
    assert_includes names, "admin_analytics_event_catalog"
    assert_includes names, "admin_create_metric_goal"
    assert_includes names, "admin_evaluate_metric_goals"

    overview = call_tool("admin_analytics_overview")
    assert_operator overview.dig("metrics", "pageviews"), :>=, 1

    funnel = call_tool("admin_analytics_funnel", steps: %w[page_viewed homepage_cta_clicked])
    assert_equal 100.0, funnel["overall_conversion_rate"]
    assert AdminAuditEvent.exists?(actor: @admin, action: "analytics.funnel.read")
  end

  test "upserts spend and includes it in acquisition reports" do
    spend = call_tool("admin_upsert_marketing_spend", {
      spend_date: Date.current.iso8601,
      channel: "organic_search",
      source: "google",
      campaign: "Holiday-Launch",
      amount: 45.5,
      currency: "usd",
      clicks: 10,
      notes: "Manual import"
    })
    assert_equal "USD", spend["currency"]
    assert_equal "holiday-launch", spend["campaign"]
    assert spend["has_notes"]

    updated = call_tool("admin_upsert_marketing_spend", {
      spend_date: Date.current.iso8601,
      channel: "organic_search",
      source: "Google",
      campaign: "holiday-launch",
      amount: 50,
      currency: "USD"
    })
    assert_equal spend["id"], updated["id"]
    assert_equal 1, MarketingSpend.where(campaign: "holiday-launch").count

    listed = call_tool("admin_list_marketing_spend", campaign: "HOLIDAY-LAUNCH")
    assert_equal 50.0, listed["total_amount"]
    assert AdminAuditEvent.exists?(actor: @admin, action: "marketing_spend.upsert")
  end

  test "requires and audits a reason for individual journeys" do
    missing_reason = call_tool_result("admin_analytics_user_journey", anonymous_id: @visitor.anonymous_id)
    assert missing_reason["isError"]

    journey = call_tool("admin_analytics_user_journey", {
      anonymous_id: @visitor.anonymous_id,
      reason: "Reviewing acquisition path"
    })
    assert_equal 2, journey["events"].length
    audit = AdminAuditEvent.find_by!(actor: @admin, action: "sensitive.analytics_journey.reveal")
    assert_equal "Reviewing acquisition path", audit.metadata["reason"]
  end

  test "runs the full agentic metric-goal lifecycle" do
    definitions = call_tool("admin_list_metric_definitions")
    assert_includes definitions.fetch("metrics").pluck("key"), "funnel_conversion_rate"

    series = call_tool("admin_analytics_timeseries", {
      metric_key: "event_count",
      from: Date.current.iso8601,
      to: Date.current.iso8601,
      filters: { event_name: "homepage_cta_clicked" }
    })
    assert_equal 1, series["value"]

    goal = call_tool("admin_create_metric_goal", {
      name: "Two homepage conversions",
      metric_key: "event_count",
      target_value: 2,
      start_date: 1.day.ago.to_date.iso8601,
      target_date: 1.day.from_now.to_date.iso8601,
      granularity: "day",
      filters: { event_name: "homepage_cta_clicked" },
      notes: "Increase high-intent homepage traffic"
    })
    assert_equal "active", goal["status"]

    updated = call_tool("admin_update_metric_goal", id: goal["id"], attributes: { target_value: 3 })
    assert_equal 3.0, updated["target_value"]

    listed = call_tool("admin_list_metric_goals", status: "active")
    assert_includes listed.fetch("goals").pluck("id"), goal["id"]

    evaluated = call_tool("admin_evaluate_metric_goals", id: goal["id"])
    evaluation = evaluated.fetch("goals").first.fetch("evaluation")
    assert_equal 1.0, evaluation["current_value"]
    assert_includes %w[on_track at_risk], evaluation["state"]
    assert evaluation["recommendation"].present?

    deleted = call_tool("admin_delete_metric_goal", id: goal["id"])
    assert deleted["deleted"]
    assert_not AnalyticsMetricGoal.exists?(goal["id"])
    assert AdminAuditEvent.exists?(actor: @admin, action: "metric_goal.evaluate")
  end

  private

  def create_event(name, occurred_at)
    AnalyticsEvent.create!(
      event_id: SecureRandom.uuid,
      event_name: name,
      occurred_at: occurred_at,
      received_at: Time.current,
      analytics_visitor: @visitor,
      anonymous_id: @visitor.anonymous_id,
      session_id: "session_analytics_12345",
      platform: "web",
      path: "/",
      landing_page: "/",
      channel: "organic_search",
      utm_source: "google"
    )
  end

  def post_mcp(method, params = {})
    post "/admin/mcp", params: {
      jsonrpc: "2.0",
      method: method,
      params: params,
      id: 1
    }.to_json, headers: {
      "Authorization" => "Bearer #{@key.raw_key}",
      "Content-Type" => "application/json"
    }
  end

  def call_tool(name, arguments = {})
    result = call_tool_result(name, arguments)
    assert_not result["isError"], result.dig("content", 0, "text")
    JSON.parse(result.dig("content", 0, "text"))
  end

  def call_tool_result(name, arguments = {})
    post_mcp("tools/call", name: name, arguments: arguments)
    assert_response :success
    json_response.fetch("result")
  end
end
