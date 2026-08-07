require "test_helper"

class AnalyticsEventsControllerTest < ActionDispatch::IntegrationTest
  test "captures a sanitized anonymous pageview with normalized attribution" do
    event = analytics_event(
      path: "/pricing?secret=query",
      referrer: "https://www.google.com/search?q=gifts",
      attribution: { utm_source: "Google", utm_medium: "cpc", gclid: "click-1" },
      properties: { location: "hero", email: "must-not-store@example.com", CheckoutToken: "must-not-store" }
    )

    post_events([ event ])

    assert_response :accepted
    assert_equal 1, json_response["accepted"]
    stored = AnalyticsEvent.find_by!(event_id: event[:event_id])
    assert_equal "/pricing", stored.path
    assert_equal "https://www.google.com/search", stored.referrer
    assert_equal "paid_search", stored.channel
    assert_equal "google", stored.utm_source
    assert_equal({ "gclid" => "click-1" }, stored.click_ids)
    assert_equal "hero", stored.properties["location"]
    assert_not stored.properties.key?("email")
    assert_not stored.properties.key?("CheckoutToken")
    assert_not_equal "127.0.0.1", stored.ip_hash
  end

  test "deduplicates retried event ids" do
    event = analytics_event
    post_events([ event ])
    post_events([ event ])

    assert_response :accepted
    assert_equal 0, json_response["accepted"]
    assert_equal 1, json_response["duplicates"]
    assert_equal 1, AnalyticsEvent.where(event_id: event[:event_id]).count
  end

  test "rejects malformed batches without storing partial data" do
    valid = analytics_event
    invalid = analytics_event(event_name: "Invalid Event")

    assert_no_difference("AnalyticsEvent.count") do
      post_events([ valid, invalid ])
    end

    assert_response :unprocessable_entity
    assert_match(/event_name is invalid/, json_response["error"])
  end

  test "honors browser privacy signals" do
    assert_no_difference("AnalyticsEvent.count") do
      post_events([ analytics_event ], headers: { "DNT" => "1" })
    end

    assert_response :accepted
    assert json_response["suppressed"]
  end

  test "stitches anonymous history to an authenticated new user and synthesizes signup" do
    anonymous_id = SecureRandom.uuid
    first = analytics_event(anonymous_id: anonymous_id)
    post_events([ first ])

    user = create_test_user(email: "analytics-user@example.com", clerk_id: "analytics_user_123")
    token = "analytics_clerk_token"
    mock_clerk_token(token, { "sub" => user.clerk_user_id, "email" => user.email })
    second = analytics_event(anonymous_id: anonymous_id, event_name: "homepage_cta_clicked")
    post_events([ second ], headers: { "Authorization" => "Bearer #{token}" })

    assert_response :accepted
    assert_equal user.id, AnalyticsVisitor.find_by!(anonymous_id: anonymous_id).user_id
    assert_equal user.id, AnalyticsEvent.find_by!(event_id: first[:event_id]).user_id
    assert AnalyticsEvent.exists?(anonymous_id: anonymous_id, user: user, event_name: "user_signed_up")
  end

  test "associates only a workspace belonging to the authenticated user" do
    user = users(:one)
    workspace = workspaces(:one)
    WorkspaceMembership.find_or_create_by!(user: user, workspace: workspace) { |membership| membership.role = "member" }
    token = "analytics_workspace_token"
    mock_clerk_token(token, { "sub" => user.clerk_user_id, "email" => user.email })

    post_events([ analytics_event ], headers: {
      "Authorization" => "Bearer #{token}",
      "X-Workspace-ID" => workspace.id.to_s
    })

    assert_response :accepted
    assert_equal workspace.id, AnalyticsEvent.order(:id).last.workspace_id
  end

  test "rejects an invalid supplied bearer token" do
    post_events([ analytics_event ], headers: { "Authorization" => "Bearer invalid" })
    assert_response :unauthorized
    assert_equal 0, AnalyticsEvent.count
  end

  test "redacts sensitive routes titles and nested identifying properties" do
    event = analytics_event(
      path: "/claim/private-claim-token",
      landing_page: "/e/family/private-share-token",
      title: "Family Secret Santa — Listy Gifty",
      referrer: "https://listygifty.com/w/private-wishlist-token?utm_source=email",
      properties: {
        path: "/join/workspace/private-invite-token",
        has_email: true,
        addresses_created: 2,
        context: { email: "nested@example.com" },
        note: "private@example.com"
      }
    )

    post_events([ event ])

    assert_response :accepted
    stored = AnalyticsEvent.find_by!(event_id: event[:event_id])
    assert_equal "/claim/:token", stored.path
    assert_equal "/e/:slug/:share_token", stored.landing_page
    assert_equal "https://listygifty.com/w/:token", stored.referrer
    assert_nil stored.title
    assert_equal "/join/:kind/:token", stored.properties["path"]
    assert_equal true, stored.properties["has_email"]
    assert_equal 2, stored.properties["addresses_created"]
    assert_not stored.properties.key?("context")
    assert_not stored.properties.key?("note")
  end

  test "requires JSON and limits the actual request body before parameter parsing" do
    post "/analytics/events", params: "not-json", headers: { "Content-Type" => "text/plain" }
    assert_response :unsupported_media_type

    oversized = { events: [ analytics_event(properties: { padding: "x" * (256.kilobytes) }) ] }.to_json
    post "/analytics/events", params: oversized, headers: {
      "Content-Type" => "application/json",
      "CONTENT_LENGTH" => "0"
    }
    assert_response :content_too_large

    [ "/analytics/events.json", "/analytics/events.xml" ].each do |path|
      post path, params: oversized, headers: {
        "Content-Type" => "application/json",
        "CONTENT_LENGTH" => "0"
      }
      assert_response :content_too_large
    end
  end

  test "synthesizes only one signup event when a new user uses multiple visitors" do
    user = create_test_user(email: "multi-device@example.com", clerk_id: "analytics_multi_device")
    token = "analytics_multi_device_token"
    mock_clerk_token(token, { "sub" => user.clerk_user_id, "email" => user.email })

    post_events([ analytics_event ], headers: { "Authorization" => "Bearer #{token}" })
    post_events([ analytics_event ], headers: { "Authorization" => "Bearer #{token}" })

    assert_response :accepted
    signups = AnalyticsEvent.where(user: user, event_name: "user_signed_up")
    assert_equal 1, signups.count
    assert_equal "signup_user_#{user.id}", signups.pick(:event_id)
  end

  private

  def analytics_event(overrides = {})
    {
      event_id: SecureRandom.uuid,
      event_name: "page_viewed",
      occurred_at: Time.current.iso8601,
      anonymous_id: SecureRandom.uuid,
      session_id: SecureRandom.uuid,
      platform: "web",
      path: "/",
      landing_page: "/",
      properties: {}
    }.merge(overrides)
  end

  def post_events(events, headers: {})
    post "/analytics/events",
      params: { events: events }.to_json,
      headers: { "Content-Type" => "application/json" }.merge(headers)
  end
end
