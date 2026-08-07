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

  test "keeps spend-only acquisition dimensions and normalizes mixed-case attribution" do
    @visitor.update!(first_touch: @visitor.first_touch.merge("utm_source" => "Google"))
    MarketingSpend.create!(
      spend_date: Date.current,
      channel: "paid_search",
      source: "GOOGLE",
      medium: "CPC",
      campaign: "Holiday",
      amount: 25,
      currency: "USD"
    )
    MarketingSpend.create!(
      spend_date: Date.current,
      channel: "paid_social",
      source: "no_traffic",
      amount: 99,
      currency: "USD"
    )

    result = @service.acquisition(group_by: "source")
    google = result[:rows].find { |row| row[:value] == "google" }
    no_traffic = result[:rows].find { |row| row[:value] == "no_traffic" }

    assert_equal 25.0, google[:spend]
    assert_equal 0, no_traffic[:visitors]
    assert_equal 0, no_traffic[:signups]
    assert_equal 99.0, no_traffic[:spend]
    assert_equal 124.0, result.dig(:totals, :spend)
  end

  test "partitions each authoritative signup into exactly one acquisition row" do
    User.where.not(id: @user.id).update_all(created_at: 1.year.ago, updated_at: Time.current)
    @user.update_columns(created_at: 2.days.ago, updated_at: Time.current)
    second_visitor = AnalyticsVisitor.create!(
      anonymous_id: SecureRandom.uuid,
      user: @user,
      first_seen_at: 2.days.ago,
      last_seen_at: 1.day.ago,
      first_channel: "paid_social",
      last_channel: "paid_social",
      first_touch: { "utm_source" => "meta" },
      last_touch: { "utm_source" => "meta" }
    )
    AnalyticsEvent.create!(
      event_id: SecureRandom.uuid,
      event_name: "page_viewed",
      occurred_at: 1.day.ago,
      received_at: Time.current,
      analytics_visitor: second_visitor,
      user: @user,
      anonymous_id: second_visitor.anonymous_id,
      session_id: SecureRandom.uuid,
      platform: "web",
      channel: "paid_social",
      utm_source: "meta"
    )

    result = @service.acquisition(group_by: "source")

    assert_equal 1, result.dig(:totals, :signups)
    assert_equal 1, result[:rows].sum { |row| row[:signups] }
    assert_equal 2, result.dig(:totals, :visitors)
  end

  test "keeps historical last-touch acquisition stable at the report boundary" do
    visitor = AnalyticsVisitor.create!(
      anonymous_id: SecureRandom.uuid,
      first_seen_at: Time.zone.parse("2026-01-10 12:00:00"),
      last_seen_at: Time.zone.parse("2026-02-10 12:00:00"),
      first_channel: "paid_search",
      last_channel: "email",
      first_touch: { "utm_source" => "google" },
      last_touch: { "utm_source" => "newsletter", "utm_medium" => "email" }
    )
    [
      [ "2026-01-10 12:00:00", "paid_search", "google", "cpc" ],
      [ "2026-02-10 12:00:00", "email", "newsletter", "email" ]
    ].each do |occurred_at, channel, source, medium|
      AnalyticsEvent.create!(
        event_id: SecureRandom.uuid,
        event_name: "page_viewed",
        occurred_at: Time.zone.parse(occurred_at),
        received_at: Time.current,
        analytics_visitor: visitor,
        anonymous_id: visitor.anonymous_id,
        session_id: SecureRandom.uuid,
        platform: "web",
        channel: channel,
        utm_source: source,
        utm_medium: medium
      )
    end

    january = @service.acquisition(
      from: "2026-01-01",
      to: "2026-01-31",
      attribution_model: "last_touch",
      group_by: "source"
    )
    through_february = @service.acquisition(
      from: "2026-01-01",
      to: "2026-02-28",
      attribution_model: "last_touch",
      group_by: "source"
    )

    assert_equal 1, january[:rows].find { |row| row[:value] == "google" }[:visitors]
    assert_nil january[:rows].find { |row| row[:value] == "newsletter" }
    assert_equal 1, through_february[:rows].find { |row| row[:value] == "newsletter" }[:visitors]
  end

  test "keeps all spend in totals when grouping by landing page" do
    MarketingSpend.create!(spend_date: Date.current, channel: "paid_search", source: "google", amount: 18, currency: "USD")

    result = @service.acquisition(group_by: "landing_page")

    assert_equal 18.0, result.dig(:totals, :spend)
  end

  test "reports page engagement, event properties, retention, and raw evidence" do
    create_event("page_viewed", 1.day.ago, path: "/signup", properties: { "location" => "header" })
    legacy = create_event(
      "legacy_sensitive_event",
      1.hour.ago,
      path: "/w/private-wishlist-token",
      properties: { "context" => "nested@example.com", "safe_count" => 2 }
    )
    legacy.update_columns(
      title: "Private wishlist title",
      referrer: "https://listygifty.com/claim/private-claim-token",
      click_ids: { "gclid" => "ad-click" }
    )

    pages = @service.pages
    assert pages[:rows].any? { |row| row[:path] == "/pricing" }

    breakdown = @service.event_breakdown(event_name: "page_viewed", group_by: "property:location")
    assert breakdown[:rows].any? { |row| row[:value] == "header" }

    catalog = @service.event_catalog
    pageviews = catalog[:events].find { |row| row[:event_name] == "page_viewed" }
    assert_equal 2, pageviews[:events]
    assert_equal 1, pageviews[:unique_actors]

    assert @service.retention[:cohorts].is_a?(Array)
    raw_events = @service.events[:events]
    serialized_legacy = raw_events.find { |event| event[:id] == legacy.id }
    assert_equal "/w/:token", serialized_legacy[:path]
    assert_nil serialized_legacy[:title]
    assert_equal "https://listygifty.com/claim/:token", serialized_legacy[:referrer]
    assert_equal({ "gclid" => "ad-click" }, serialized_legacy[:click_ids])
    assert_equal({ "safe_count" => 2 }, serialized_legacy[:properties])
    assert_equal 5, raw_events.length
    assert_equal 5, @service.journey(user_id: @user.id)[:events].length
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
