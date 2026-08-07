require "test_helper"

class Analytics::QueryServiceTest < ActiveSupport::TestCase
  def setup
    @service = Analytics::QueryService.new
    @user = users(:one)
    @visitor = AnalyticsVisitor.create!(
      anonymous_id: SecureRandom.uuid,
      user: @user,
      first_seen_at: 3.days.ago,
      last_seen_at: 1.day.ago,
      first_landing_page: "/pricing",
      last_landing_page: "/pricing",
      first_channel: "paid_search",
      last_channel: "email",
      first_touch: { "utm_source" => "google", "utm_medium" => "cpc", "utm_campaign" => "holiday" },
      last_touch: { "utm_source" => "newsletter", "utm_medium" => "email" }
    )
    @session = SecureRandom.uuid
    create_event("page_viewed", 3.days.ago, path: "/pricing")
    create_event("homepage_cta_clicked", 2.days.ago)
    create_event("user_signed_up", 1.day.ago)
  end

  test "reports overview and ordered funnel conversion" do
    overview = @service.overview
    assert_operator overview.dig(:metrics, :pageviews), :>=, 1
    assert_operator overview.dig(:metrics, :sessions), :>=, 1

    funnel = @service.funnel(steps: %w[page_viewed homepage_cta_clicked user_signed_up])
    assert_equal [ 1, 1, 1 ], funnel[:steps].pluck(:actors)
    assert_equal 100.0, funnel[:overall_conversion_rate]
    assert_operator funnel[:steps].last[:median_seconds_from_previous], :>, 0
  end

  test "combines acquisition conversion with campaign spend" do
    @user.update_columns(created_at: 2.days.ago, updated_at: Time.current)
    MarketingSpend.create!(
      spend_date: 2.days.ago.to_date,
      channel: "paid_search",
      source: "google",
      medium: "cpc",
      campaign: "holiday",
      amount: 100,
      clicks: 20,
      currency: "USD"
    )

    result = @service.acquisition(group_by: "source")
    google = result[:rows].find { |row| row[:value] == "google" }
    assert_equal 1, google[:signups]
    assert_equal 100.0, google[:spend]
    assert_equal 5.0, google[:cpc]
    assert_equal 100.0, google[:cost_per_signup]
  end

  test "reports page engagement, event properties, retention, and raw evidence" do
    create_event("page_viewed", 1.day.ago, path: "/signup", properties: { "location" => "header" })

    pages = @service.pages
    assert pages[:rows].any? { |row| row[:path] == "/pricing" }

    breakdown = @service.event_breakdown(event_name: "page_viewed", group_by: "property:location")
    assert breakdown[:rows].any? { |row| row[:value] == "header" }

    catalog = @service.event_catalog
    pageviews = catalog[:events].find { |row| row[:event_name] == "page_viewed" }
    assert_equal 2, pageviews[:events]
    assert_equal 1, pageviews[:unique_actors]

    assert @service.retention[:cohorts].is_a?(Array)
    assert_equal 4, @service.events[:events].length
    assert_equal 4, @service.journey(user_id: @user.id)[:events].length
  end

  private

  def create_event(name, occurred_at, path: nil, properties: {})
    AnalyticsEvent.create!(
      event_id: SecureRandom.uuid,
      event_name: name,
      occurred_at: occurred_at,
      received_at: Time.current,
      analytics_visitor: @visitor,
      user: @user,
      anonymous_id: @visitor.anonymous_id,
      session_id: @session,
      platform: "web",
      path: path,
      landing_page: "/pricing",
      channel: "paid_search",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "holiday",
      properties: properties
    )
  end
end
