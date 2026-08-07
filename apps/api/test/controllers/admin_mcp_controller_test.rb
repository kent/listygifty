require "test_helper"

class AdminMcpControllerTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  def setup
    @admin = User.create!(
      email: Admin::Authorization::DEFAULT_ADMIN_EMAIL,
      clerk_user_id: "user_admin_mcp",
      subscription_plan: "free"
    )
    @workspace = Workspace.create!(
      name: "Admin MCP Workspace",
      workspace_type: "personal",
      created_by_user: @admin
    )
    @workspace.workspace_memberships.create!(user: @admin, role: "owner")
    @admin_key = ApiKey.generate_for(@admin, name: "Admin MCP", scopes: [ "admin" ])
    @secondary_admin_key = ApiKey.generate_for(@admin, name: "Secondary Admin MCP", scopes: [ "admin" ])
    @read_key = ApiKey.generate_for(@admin, name: "Read MCP", scopes: [ "read", "write" ])
    @other_admin_key = ApiKey.generate_for(users(:one), name: "Wrong Admin", scopes: [ "admin" ])
  end

  def teardown
    clear_enqueued_jobs
    clear_performed_jobs
  end

  test "requires an allowlisted admin-scoped API key and rejects OAuth-style bearer tokens" do
    post_admin_mcp(method: "ping", headers: { "Content-Type" => "application/json" })
    assert_response :unauthorized

    post_admin_mcp(method: "ping", token: "oauth-token")
    assert_response :unauthorized

    post_admin_mcp(method: "ping", token: @read_key.raw_key)
    assert_response :forbidden

    post_admin_mcp(method: "ping", token: @other_admin_key.raw_key)
    assert_response :forbidden

    post_admin_mcp(method: "ping")
    assert_response :success
    assert json_response.dig("result", "pong")
    assert AdminAuditEvent.exists?(actor: @admin, action: "admin_mcp.authenticate")
    audit = AdminAuditEvent.where(actor: @admin, action: "admin_mcp.authenticate").order(:id).last
    assert_equal @admin_key.api_key.id, audit.resource_id
  end

  test "accepts only bearer credentials and applies the endpoint kill switch" do
    post_admin_mcp(method: "ping", headers: {
      "X-API-Key" => @admin_key.raw_key,
      "Content-Type" => "application/json"
    })
    assert_response :unauthorized

    with_env("ADMIN_MCP_ENABLED", "false") do
      post_admin_mcp(method: "ping")
      assert_response :not_found
    end
  end

  test "rejects legacy non-expiring admin keys" do
    legacy = ApiKey.generate_for(@admin, name: "Legacy admin", scopes: [ "admin" ])
    legacy.api_key.update_column(:expires_at, nil)

    post_admin_mcp(method: "ping", token: legacy.raw_key)

    assert_response :forbidden
  end

  test "enforces content type, origin, request size, and defensive response headers" do
    post "/admin/mcp", params: "{}", headers: {
      "Authorization" => "Bearer #{@admin_key.raw_key}",
      "Content-Type" => "text/plain"
    }
    assert_response :unsupported_media_type
    assert_equal %w[no-store private], response.headers["Cache-Control"].split(", ").sort
    assert_equal "no-referrer", response.headers["Referrer-Policy"]

    post_admin_mcp(method: "ping", headers: admin_headers.merge("Origin" => "https://evil.example"))
    assert_response :forbidden
    assert_equal %w[no-store private], response.headers["Cache-Control"].split(", ").sort
    assert_equal "no-referrer", response.headers["Referrer-Policy"]

    with_env("ADMIN_MCP_ALLOWED_ORIGINS", "https://trusted.example") do
      post_admin_mcp(method: "ping", headers: admin_headers.merge("Origin" => "https://trusted.example"))
      assert_response :success
    end

    post "/admin/mcp", params: "x" * (AdminMcpController::MAX_REQUEST_BYTES + 1), headers: admin_headers
    assert_response :content_too_large

    post_admin_mcp(method: "ping")
    assert_equal %w[no-store private], response.headers["Cache-Control"].split(", ").sort
    assert_equal "no-cache", response.headers["Pragma"]
    assert_equal "nosniff", response.headers["X-Content-Type-Options"]
    assert_equal "no-referrer", response.headers["Referrer-Policy"]
  end

  test "initializes as a separate MCP server and lists the complete admin tool surface" do
    post_admin_mcp(
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }
    )
    assert_equal "listygifty-admin-mcp", json_response.dig("result", "serverInfo", "name")

    post_admin_mcp(method: "tools/list")
    names = json_response.dig("result", "tools").pluck("name")
    assert_includes names, "admin_get_stats"
    assert_includes names, "admin_create_record"
    assert_includes names, "admin_reveal_wishlist_claims"
    assert_includes names, "admin_preview_email"
    assert_includes names, "admin_confirm_user_deletion"

    resources = call_tool("admin_list_resource_types").fetch("resources").pluck("name")
    assert_equal 28, resources.length
    assert_includes resources, "email_deliveries"
    assert_includes resources, "gift_suggestions"
  end

  test "handles JSON-RPC parse errors and batches" do
    post "/admin/mcp", params: "not-json", headers: admin_headers
    assert_response :success
    assert_equal(-32700, json_response.dig("error", "code"))

    post "/admin/mcp", params: [
      { jsonrpc: "2.0", method: "ping", id: 1 },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", method: "tools/list", id: 2 }
    ].to_json, headers: admin_headers
    assert_response :success
    assert_equal [ 1, 2 ], json_response.pluck("id")

    post "/admin/mcp", params: [].to_json, headers: admin_headers
    assert_equal(-32600, json_response.dig("error", "code"))

    oversized_batch = Array.new(AdminMcpController::MAX_BATCH_SIZE + 1) do |index|
      { jsonrpc: "2.0", method: "ping", id: index }
    end
    post "/admin/mcp", params: oversized_batch.to_json, headers: admin_headers
    assert_equal(-32600, json_response.dig("error", "code"))

    nested = "{\"jsonrpc\":\"2.0\",\"method\":\"ping\",\"id\":1,\"params\":" + ("{\"x\":" * 33) + "null" + ("}" * 33) + "}"
    post "/admin/mcp", params: nested, headers: admin_headers
    assert_equal(-32700, json_response.dig("error", "code"))
  end

  test "rejects invalid message shapes and never executes notification-shaped tool calls" do
    post "/admin/mcp", params: { jsonrpc: "2.0", method: "ping", params: [], id: 1 }.to_json, headers: admin_headers
    assert_equal(-32600, json_response.dig("error", "code"))

    post "/admin/mcp", params: { jsonrpc: "2.0", method: "ping", id: true }.to_json, headers: admin_headers
    assert_equal(-32600, json_response.dig("error", "code"))

    assert_no_difference("GiftStatus.count") do
      post "/admin/mcp", params: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "admin_create_record",
          arguments: { resource: "gift_statuses", attributes: { name: "Silent mutation", position: 999 } }
        }
      }.to_json, headers: admin_headers
    end
    assert_response :no_content
  end

  test "enforces advertised tool schemas before invoking handlers" do
    unknown = call_tool_result("admin_get_stats", period_days: 7, unexpected: true)
    assert unknown["isError"]
    assert_includes unknown.dig("content", 0, "text"), "unknown unexpected"

    wrong_type = call_tool_result("admin_get_stats", period_days: "seven")
    assert wrong_type["isError"]
    assert_includes wrong_type.dig("content", 0, "text"), "expected integer"

    too_large = call_tool_result("admin_get_stats", period_days: 500)
    assert too_large["isError"]
    assert_includes too_large.dig("content", 0, "text"), "above the maximum"
  end

  test "returns product-wide stats with a zero-filled daily series" do
    payload = call_tool("admin_get_stats", period_days: 7)

    assert_operator payload.dig("totals", "users"), :>=, 3
    assert_equal 7, payload.dig("daily_creations", "users").length
    assert_equal 7, payload.dig("period", "days")
    assert AdminAuditEvent.exists?(actor: @admin, action: "stats.read")
  end

  test "provides allowlisted CRUD with bulk email and secret redaction" do
    created = call_tool("admin_create_record", {
      resource: "users",
      attributes: {
        email: "created-by-admin@example.com",
        clerk_user_id: "user_created_by_admin",
        subscription_plan: "free",
        first_name: "Created"
      }
    })
    user_id = created.fetch("id")
    assert_equal "created-by-admin@example.com", created["email"]
    assert Workspace.exists?(created_by_user_id: user_id, workspace_type: "personal")

    list = call_tool("admin_list_records", resource: "users", filters: { id: user_id })
    listed = list.fetch("records").sole
    assert_not listed.key?("email")
    assert_includes listed.fetch("_redacted_fields"), "email"

    detail = call_tool("admin_get_record", resource: "users", id: user_id)
    assert_equal "created-by-admin@example.com", detail["email"]
    assert_not detail.key?("email_preferences_token")

    updated = call_tool("admin_update_record", resource: "users", id: user_id, attributes: { first_name: "Updated" })
    assert_equal "Updated", updated["first_name"]

    status = call_tool("admin_create_record", resource: "gift_statuses", attributes: { name: "Admin temporary", position: 99 })
    deleted = call_tool("admin_delete_record", resource: "gift_statuses", id: status.fetch("id"))
    assert deleted["deleted"]
    assert_not GiftStatus.exists?(status.fetch("id"))

    error = call_tool_result("admin_delete_record", resource: "users", id: user_id)
    assert error["isError"]
    assert_includes error.dig("content", 0, "text"), "admin_preview_user_deletion"
  end

  test "reveals wishlist claims and exchange matches only through reasoned audited tools" do
    wishlist = Wishlist.create!(user: @admin, workspace: @workspace, name: "Private list", visibility: "private")
    item = wishlist.wishlist_items.create!(name: "Surprise")
    claim = item.claims.create!(user: users(:one), quantity: 1, status: "reserved")

    redacted = call_tool("admin_get_record", resource: "wishlist_item_claims", id: claim.id)
    assert_not redacted.key?("user_id")
    assert_includes redacted.fetch("_redacted_fields"), "user_id"

    filtered = call_tool_result("admin_list_records", resource: "wishlist_item_claims", filters: { user_id: users(:one).id })
    assert filtered["isError"]
    assert_includes filtered.dig("content", 0, "text"), "Unsupported filters"

    claims = call_tool("admin_reveal_wishlist_claims", wishlist_id: wishlist.id, reason: "Customer support request")
    assert_equal users(:one).email, claims.dig("claims", 0, "claimant", "email")
    claim_audit = AdminAuditEvent.find_by!(action: "sensitive.wishlist_claims.reveal", resource_id: wishlist.id)
    assert_equal "Customer support request", claim_audit.metadata["reason"]

    exchange = GiftExchange.create!(user: @admin, workspace: @workspace, name: "Admin exchange", status: "active")
    giver = exchange.exchange_participants.create!(name: "Giver", email: "giver@example.com", status: "accepted")
    recipient = exchange.exchange_participants.create!(name: "Recipient", email: "recipient@example.com", status: "accepted")
    giver.update!(matched_participant: recipient)

    participant = call_tool("admin_get_record", resource: "exchange_participants", id: giver.id)
    assert_not participant.key?("matched_participant_id")

    matches = call_tool("admin_reveal_exchange_matches", exchange_id: exchange.id, reason: "Investigating draw")
    assert_equal recipient.email, matches.dig("matches", 0, "recipient", "email")
    assert AdminAuditEvent.exists?(action: "sensitive.exchange_matches.reveal", resource_id: exchange.id)
  end

  test "previews and confirms a registered-user email exactly once without auditing its body" do
    preview = call_tool("admin_preview_email", {
      user_id: users(:one).id,
      subject: "A note from Listy Gifty",
      body: "Private body that must not enter the audit metadata"
    })
    token = preview.fetch("confirmation_token")
    draft = AdminEmailDraft.find(preview.fetch("draft_id"))

    assert_equal users(:one).email, preview.dig("recipient", "email")
    assert_not_equal token, draft.confirmation_digest
    assert_not_includes AdminAuditEvent.find_by!(action: "email.preview").metadata.to_json, "Private body"

    assert_enqueued_emails 1 do
      result = call_tool("admin_confirm_email", confirmation_token: token)
      assert_equal "queued", result["status"]
    end

    repeated = call_tool_result("admin_confirm_email", confirmation_token: token)
    assert repeated["isError"]
    assert_includes repeated.dig("content", 0, "text"), "already been queued"
  end

  test "binds email confirmations to the exact admin API key" do
    preview = call_tool("admin_preview_email", user_id: users(:one).id, subject: "Bound", body: "Do not send from another key")

    wrong_key = call_tool_result(
      "admin_confirm_email",
      { confirmation_token: preview.fetch("confirmation_token") },
      token: @secondary_admin_key.raw_key
    )
    assert wrong_key["isError"]
    assert_includes wrong_key.dig("content", 0, "text"), "another API key"
    assert_no_enqueued_emails

    assert_enqueued_emails 1 do
      call_tool("admin_confirm_email", confirmation_token: preview.fetch("confirmation_token"))
    end
  end

  test "rejects an expired email confirmation" do
    preview = call_tool("admin_preview_email", user_id: users(:one).id, subject: "Expired", body: "Do not send")
    AdminEmailDraft.find(preview.fetch("draft_id")).update_column(:expires_at, 1.minute.ago)

    result = call_tool_result("admin_confirm_email", confirmation_token: preview.fetch("confirmation_token"))
    assert result["isError"]
    assert_includes result.dig("content", 0, "text"), "expired"
    assert_no_enqueued_emails
  end

  test "requires a new user deletion preview when the impact changes" do
    target = create_test_user(email: "changing@example.com", clerk_id: "user_changing")
    preview = call_tool("admin_preview_user_deletion", user_id: target.id)
    target.people.create!(workspace: target.personal_workspace, name: "Added after preview")

    result = call_tool_result("admin_confirm_user_deletion", confirmation_token: preview.fetch("confirmation_token"))
    assert result["isError"]
    assert_includes result.dig("content", 0, "text"), "data changed after preview"
    assert User.exists?(target.id)
  end

  test "previews and confirms destructive user deletion while protecting the sole admin" do
    target = create_test_user(email: "delete-me@example.com", clerk_id: "user_delete_me")
    holiday = target.personal_workspace.holidays.create!(name: "Delete my gifts")
    HolidayUser.create!(holiday: holiday, user: target, role: "owner")
    holiday.gifts.create!(name: "Gone", gift_status: gift_statuses(:idea), created_by: target)
    visitor = AnalyticsVisitor.create!(
      anonymous_id: SecureRandom.uuid,
      user: target,
      first_seen_at: 1.day.ago,
      last_seen_at: Time.current,
      first_touch: {},
      last_touch: {}
    )
    analytics_event = AnalyticsEvent.create!(
      event_id: SecureRandom.uuid,
      event_name: "page_viewed",
      occurred_at: 1.hour.ago,
      received_at: Time.current,
      analytics_visitor: visitor,
      user: target,
      anonymous_id: visitor.anonymous_id,
      session_id: SecureRandom.uuid,
      platform: "web",
      channel: "direct"
    )

    protected_result = call_tool_result("admin_preview_user_deletion", user_id: @admin.id)
    assert protected_result["isError"]

    preview = call_tool("admin_preview_user_deletion", user_id: target.id)
    assert_equal 1, preview.dig("impact", "workspaces_created")
    assert_equal 1, preview.dig("impact", "gifts_in_created_workspaces")
    assert_equal 1, preview.dig("impact", "analytics_visitors")
    assert_equal 1, preview.dig("impact", "analytics_events")

    wrong_key = call_tool_result(
      "admin_confirm_user_deletion",
      { confirmation_token: preview.fetch("confirmation_token") },
      token: @secondary_admin_key.raw_key
    )
    assert wrong_key["isError"]
    assert_includes wrong_key.dig("content", 0, "text"), "another API key"
    assert User.exists?(target.id)

    result = call_tool("admin_confirm_user_deletion", confirmation_token: preview.fetch("confirmation_token"))
    assert result["deleted"]
    assert_not User.exists?(target.id)
    assert_not Workspace.exists?(created_by_user_id: target.id)
    assert_not AnalyticsVisitor.exists?(visitor.id)
    assert_not AnalyticsEvent.exists?(analytics_event.id)
    assert AdminAuditEvent.exists?(action: "user_deletion.confirm", resource_id: target.id)

    repeated = call_tool_result("admin_confirm_user_deletion", confirmation_token: preview.fetch("confirmation_token"))
    assert repeated["isError"]
    assert_includes repeated.dig("content", 0, "text"), "already been used"
  end

  private

  def post_admin_mcp(method:, params: {}, token: @admin_key.raw_key, headers: nil)
    request_headers = headers || admin_headers(token)
    post "/admin/mcp", params: {
      jsonrpc: "2.0",
      method: method,
      params: params,
      id: 1
    }.to_json, headers: request_headers
  end

  def admin_headers(token = @admin_key.raw_key)
    { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" }
  end

  def call_tool(name, arguments = nil, token: @admin_key.raw_key, **keyword_arguments)
    arguments = (arguments || {}).merge(keyword_arguments)
    result = call_tool_result(name, arguments, token: token)
    assert_not result["isError"], result.dig("content", 0, "text")
    JSON.parse(result.dig("content", 0, "text"))
  end

  def call_tool_result(name, arguments = nil, token: @admin_key.raw_key, **keyword_arguments)
    arguments = (arguments || {}).merge(keyword_arguments)
    post_admin_mcp(method: "tools/call", params: { name: name, arguments: arguments }, token: token)
    assert_response :success
    json_response.fetch("result")
  end

  def with_env(name, value)
    previous = ENV[name]
    ENV[name] = value
    yield
  ensure
    previous.nil? ? ENV.delete(name) : ENV[name] = previous
  end
end
