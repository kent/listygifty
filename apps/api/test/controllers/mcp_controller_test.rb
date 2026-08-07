require "test_helper"

class McpControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user = users(:one)
    @workspace = workspaces(:one)

    # Create workspace membership
    WorkspaceMembership.find_or_create_by!(user: @user, workspace: @workspace) do |m|
      m.role = "owner"
    end

    @client = OauthClient.register_system_client(
      name: "Test MCP Client",
      client_id: "test-mcp-client",
      redirect_uris: [ "https://example.com/callback" ]
    )

    @token_result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read", "write" ],
      resource: "http://www.example.com/mcp"
    )

    @api_key_result = ApiKey.generate_for(@user, name: "Test MCP Key", scopes: [ "read", "write" ])
  end

  def auth_headers(token = nil)
    { "Authorization" => "Bearer #{token || @token_result.token}" }
  end

  def api_key_headers
    { "Authorization" => "Bearer #{@api_key_result.raw_key}" }
  end

  def call_tool(name, arguments = {}, headers: auth_headers)
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: name, arguments: arguments },
      id: 1
    }.to_json, headers: headers.merge("Content-Type" => "application/json")

    assert_response :success
    JSON.parse(response.body).fetch("result")
  end

  def tool_payload(result)
    JSON.parse(result.fetch("content").first.fetch("text"))
  end

  # Authentication tests
  test "returns 401 without authentication" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "ping",
      id: 1
    }.to_json, headers: { "Content-Type" => "application/json" }

    assert_response :unauthorized
    assert response.headers["WWW-Authenticate"].present?
    assert response.headers["WWW-Authenticate"].include?("Bearer")
    assert_includes response.headers["WWW-Authenticate"], 'resource_metadata="http://www.example.com/.well-known/oauth-protected-resource/mcp"'
  end

  test "rejects browser Origin headers unless explicitly allowlisted" do
    post "/mcp", params: { jsonrpc: "2.0", method: "ping", id: 1 }.to_json,
      headers: auth_headers.merge("Content-Type" => "application/json", "Origin" => "https://evil.example")
    assert_response :forbidden
    get "/mcp", headers: auth_headers.merge("Origin" => "https://evil.example")
    assert_response :forbidden

    previous = ENV["MCP_ALLOWED_ORIGINS"]
    ENV["MCP_ALLOWED_ORIGINS"] = "https://trusted.example"
    post "/mcp", params: { jsonrpc: "2.0", method: "ping", id: 1 }.to_json,
      headers: auth_headers.merge("Content-Type" => "application/json", "Origin" => "https://trusted.example")
    assert_response :success
    get "/mcp", headers: auth_headers.merge("Origin" => "https://trusted.example")
    assert_response :method_not_allowed
  ensure
    previous.nil? ? ENV.delete("MCP_ALLOWED_ORIGINS") : ENV["MCP_ALLOWED_ORIGINS"] = previous
  end

  test "validates MCP-Protocol-Version before dispatch" do
    invalid_headers = auth_headers.merge(
      "Content-Type" => "application/json",
      "MCP-Protocol-Version" => "2099-01-01"
    )
    assert_no_difference("Wishlist.count") do
      post "/mcp", params: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "create_wishlist",
          arguments: { workspace_id: @workspace.id, name: "Must not be created" }
        },
        id: 1
      }.to_json, headers: invalid_headers
    end
    assert_response :bad_request

    get "/mcp", headers: invalid_headers.except("Content-Type")
    assert_response :bad_request

    post "/mcp", params: { jsonrpc: "2.0", method: "ping", id: 1 }.to_json,
      headers: auth_headers.merge(
        "Content-Type" => "application/json",
        "MCP-Protocol-Version" => McpTransportSecurity::SUPPORTED_PROTOCOL_VERSIONS.first
      )
    assert_response :success
  end

  test "requires the Streamable HTTP JSON content type" do
    post "/mcp", params: "{}", headers: auth_headers.merge("Content-Type" => "text/plain")

    assert_response :unsupported_media_type
    assert_includes response.headers["Cache-Control"], "no-store"
  end

  test "rejects long-lived GET transport without occupying an application thread" do
    get "/mcp", headers: auth_headers

    assert_response :method_not_allowed
    assert_equal "POST", response.headers["Allow"]
  end

  test "accepts OAuth bearer token" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "ping",
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "2.0", json["jsonrpc"]
    assert_equal 1, json["id"]
    assert json["result"]["pong"]
  end

  test "parses Bearer authentication strictly and case-insensitively" do
    payload = { jsonrpc: "2.0", method: "ping", id: 1 }.to_json

    post "/mcp", params: payload,
      headers: { "Authorization" => "bEaReR #{@token_result.token}", "Content-Type" => "application/json" }
    assert_response :success

    post "/mcp", params: payload,
      headers: { "Authorization" => "Bearer junk #{@token_result.token}", "Content-Type" => "application/json" }
    assert_response :unauthorized

    post "/mcp", params: payload,
      headers: { "Authorization" => "bearer #{@api_key_result.raw_key}", "Content-Type" => "application/json" }
    assert_response :success
  end

  test "rejects unprefixed and version-one tokens from the legacy authorization flow" do
    version_one = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: "http://www.example.com/mcp"
    )
    version_one.access_token.update_column(:credential_version, 1)
    post "/mcp", params: { jsonrpc: "2.0", method: "ping", id: 1 }.to_json,
      headers: auth_headers(version_one.token).merge("Content-Type" => "application/json")
    assert_response :unauthorized

    legacy_raw = SecureRandom.urlsafe_base64(32)
    OauthAccessToken.create!(
      oauth_client: @client,
      user: @user,
      token_hash: Digest::SHA256.hexdigest(legacy_raw),
      scopes: [ "read" ],
      resource: "http://www.example.com/mcp",
      expires_at: 1.hour.from_now
    )

    post "/mcp", params: { jsonrpc: "2.0", method: "ping", id: 1 }.to_json,
      headers: auth_headers(legacy_raw).merge("Content-Type" => "application/json")
    assert_response :unauthorized
  end

  test "rejects OAuth tokens without the exact ordinary MCP audience and scopes" do
    wrong_resource = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: "http://www.example.com/admin/mcp"
    )
    post "/mcp", params: { jsonrpc: "2.0", method: "ping", id: 1 }.to_json,
      headers: auth_headers(wrong_resource.token).merge("Content-Type" => "application/json")
    assert_response :unauthorized

    wrong_scope = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: "http://www.example.com/mcp"
    )
    wrong_scope.access_token.update_column(:scopes, [ "admin" ])
    post "/mcp", params: { jsonrpc: "2.0", method: "ping", id: 1 }.to_json,
      headers: auth_headers(wrong_scope.token).merge("Content-Type" => "application/json")
    assert_response :unauthorized
  end

  test "accepts API key authentication" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "ping",
      id: 1
    }.to_json, headers: api_key_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert json["result"]["pong"]
  end

  test "rejects invalid OAuth token" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "ping",
      id: 1
    }.to_json, headers: { "Authorization" => "Bearer invalid_token", "Content-Type" => "application/json" }

    assert_response :unauthorized
  end

  # JSON-RPC tests
  test "returns parse error for invalid JSON" do
    post "/mcp",
      params: "not json",
      headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal -32700, json["error"]["code"]
  end

  test "returns invalid request for malformed JSON-RPC" do
    post "/mcp", params: {
      invalid: "request"
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal -32600, json["error"]["code"]
  end

  test "returns method not found for unknown method" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "unknown_method",
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal -32601, json["error"]["code"]
    assert json["error"]["message"].include?("unknown_method")
  end

  # Protocol methods
  test "handles initialize" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" }
      },
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "2025-06-18", json["result"]["protocolVersion"]
    # capabilities is returned as empty hash {} since we declare tools/resources support
    assert json["result"]["capabilities"].is_a?(Hash)
    assert json["result"]["serverInfo"]["name"].present?
  end

  test "handles tools/list" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert json["result"]["tools"].is_a?(Array)
    assert json["result"]["tools"].any? { |t| t["name"] == "list_workspaces" }
    assert json["result"]["tools"].any? { |t| t["name"] == "update_holiday" }
    assert json["result"]["tools"].any? { |t| t["name"] == "update_gift" }
    assert json["result"]["tools"].any? { |t| t["name"] == "update_person" }
    assert json["result"]["tools"].any? { |t| t["name"] == "create_wishlist" }
    assert json["result"]["tools"].any? { |t| t["name"] == "claim_wishlist_item" }
    assert json["result"]["tools"].any? { |t| t["name"] == "create_gift_exchange" }
    assert json["result"]["tools"].any? { |t| t["name"] == "start_gift_exchange" }
    assert json["result"]["tools"].any? { |t| t["name"] == "publish_gift_exchange" }
    assert json["result"]["tools"].any? { |t| t["name"] == "redo_gift_exchange" }
    assert json["result"]["tools"].any? { |t| t["name"] == "accept_exchange_invite" }
    assert json["result"]["tools"].any? { |t| t["name"] == "nudge_exchange_match" }
    assert json["result"]["tools"].any? { |t| t["name"] == "list_exchange_notifications" }
    assert json["result"]["tools"].any? { |t| t["name"] == "create_exchange_wishlist_item" }
  end

  test "handles resources/list" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "resources/list",
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert json["result"]["resources"].is_a?(Array)
    assert json["result"]["resources"].any? { |r| r["uri"] == "listygifty://dashboard" }
  end

  # Tool calls
  test "handles tools/call for list_workspaces" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "list_workspaces",
        arguments: {}
      },
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert json["result"]["content"].is_a?(Array)
    assert_equal "text", json["result"]["content"].first["type"]
  end

  test "filters holidays and wishlists by membership and visibility" do
    other_user = users(:two)
    WorkspaceMembership.find_or_create_by!(user: other_user, workspace: @workspace) { |membership| membership.role = "member" }
    hidden_holiday = @workspace.holidays.create!(name: "Hidden occasion", date: 1.month.from_now)
    hidden_holiday.holiday_users.create!(user: other_user, role: "owner")
    private_wishlist = @workspace.wishlists.create!(user: other_user, name: "Private list", visibility: "private")
    shared_wishlist = @workspace.wishlists.create!(user: other_user, name: "Link-only list", visibility: "shared")
    visible_wishlist = @workspace.wishlists.create!(user: other_user, name: "Workspace list", visibility: "workspace")

    holidays = tool_payload(call_tool("list_holidays", { workspace_id: @workspace.id }))
    assert_not_includes holidays.pluck("id"), hidden_holiday.id

    wishlists = tool_payload(call_tool("list_wishlists", { workspace_id: @workspace.id }))
    wishlist_ids = wishlists.pluck("id")
    assert_not_includes wishlist_ids, private_wishlist.id
    assert_not_includes wishlist_ids, shared_wishlist.id
    assert_includes wishlist_ids, visible_wishlist.id

    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "resources/read",
      params: { uri: "listygifty://dashboard" },
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")
    dashboard = JSON.parse(JSON.parse(response.body).dig("result", "contents", 0, "text"))
    assert_not_includes dashboard.fetch("upcoming_holidays").pluck("id"), hidden_holiday.id
  end

  test "person tools hide and protect addresses outside the caller's workspace" do
    owner = users(:two)
    owner_workspace = Workspace.create!(
      name: "Owner business",
      workspace_type: "business",
      created_by_user: owner
    )
    owner_workspace.workspace_memberships.create!(user: owner, role: "owner")
    profile = owner_workspace.create_company_profile!(name: "Owner Co")
    private_address = profile.addresses.create!(
      label: "Private home",
      street_line_1: "99 Secret Lane",
      city: "Toronto",
      postal_code: "M5V 1A1",
      country: "CA"
    )
    alternate_address = profile.addresses.create!(
      label: "Private office",
      street_line_1: "100 Secret Lane",
      city: "Toronto",
      postal_code: "M5V 1A2",
      country: "CA"
    )
    person = owner_workspace.people.create!(
      name: "Shared external contact",
      user: owner,
      default_shipping_address: private_address
    )
    holiday = owner_workspace.holidays.create!(name: "Shared occasion")
    holiday.holiday_users.create!(user: owner, role: "owner")
    holiday.holiday_users.create!(user: @user, role: "collaborator")
    HolidayPerson.create!(holiday: holiday, person: person)

    external = tool_payload(call_tool("get_person", { person_id: person.id }))
    assert_nil external["default_shipping_address_id"]
    assert_nil external["default_shipping_address"]

    result = call_tool("update_person", {
      person_id: person.id,
      name: "Corrupted name",
      default_shipping_address_id: alternate_address.id
    })
    assert result["isError"]
    assert_equal "Shared external contact", person.reload.name
    assert_equal private_address.id, person.default_shipping_address_id

    created_gift = tool_payload(call_tool("create_gift", {
      holiday_id: holiday.id,
      name: "Address-safe gift",
      recipient_ids: [ person.id ]
    }))
    [
      created_gift,
      tool_payload(call_tool("get_gift", { gift_id: created_gift.fetch("id") })),
      tool_payload(call_tool("update_gift", { gift_id: created_gift.fetch("id"), name: "Still safe" }))
    ].each do |serialized_gift|
      recipient = serialized_gift.fetch("gift_recipients").first
      assert_nil recipient["shipping_address_id"]
      assert_nil recipient["shipping_address"]
    end

    owner_workspace.workspace_memberships.create!(user: @user, role: "member")
    result = call_tool("update_person", {
      person_id: person.id,
      default_shipping_address_id: alternate_address.id
    })
    assert result["isError"]
    assert_equal private_address.id, person.reload.default_shipping_address_id
    updated_person = tool_payload(call_tool("update_person", { person_id: person.id, name: "Member edit" }))
    assert_equal "Member edit", updated_person["name"]

    own_workspace = Workspace.create!(
      name: "Own business",
      workspace_type: "business",
      created_by_user: @user
    )
    own_workspace.workspace_memberships.create!(user: @user, role: "owner")
    own_profile = own_workspace.create_company_profile!(name: "Own Co")
    own_address = own_profile.addresses.create!(
      label: "Visible home",
      street_line_1: "1 Visible Street",
      city: "Toronto",
      postal_code: "M5V 2B2",
      country: "CA"
    )
    own_person = own_workspace.people.create!(name: "Own contact", user: @user, default_shipping_address: own_address)
    visible = tool_payload(call_tool("get_person", { person_id: own_person.id }))
    assert_equal own_address.id, visible["default_shipping_address_id"]
    assert_equal "1 Visible Street", visible.dig("default_shipping_address", "street_line_1")
    updated = tool_payload(call_tool("update_person", {
      person_id: own_person.id,
      default_shipping_address_id: own_address.id
    }))
    assert_equal own_address.id, updated["default_shipping_address_id"]
  end

  test "gift mutations reject inaccessible holidays and people before writing" do
    own_holiday = @workspace.holidays.create!(name: "Own occasion", date: 2.months.from_now)
    own_holiday.holiday_users.create!(user: @user, role: "owner")
    status = GiftStatus.by_position.first!
    gift = own_holiday.gifts.create!(name: "Original", gift_status: status, created_by: @user)

    victim = users(:two)
    victim_workspace = workspaces(:two)
    victim_holiday = victim_workspace.holidays.create!(name: "Victim occasion", date: 3.months.from_now)
    victim_holiday.holiday_users.create!(user: victim, role: "owner")
    victim_person = victim_workspace.people.create!(name: "Private contact", user: victim)

    %w[recipient_ids giver_ids].each do |person_field|
      assert_no_difference("Gift.count") do
        result = call_tool("create_gift", {
          holiday_id: own_holiday.id,
          name: "Rejected gift",
          person_field => [ victim_person.id ]
        })
        assert result["isError"]
      end
    end

    result = call_tool("update_gift", { gift_id: gift.id, holiday_id: victim_holiday.id })
    assert result["isError"]
    assert_equal own_holiday.id, gift.reload.holiday_id

    %w[recipient_ids giver_ids].each do |person_field|
      result = call_tool("update_gift", { gift_id: gift.id, person_field => [ victim_person.id ] })
      assert result["isError"]
      assert_empty gift.reload.public_send(person_field)
    end
  end

  test "external holiday collaborators can use only explicitly shared people" do
    owner = users(:two)
    owner_workspace = workspaces(:two)
    owner_workspace.workspace_memberships.where(user: @user).delete_all
    holiday = owner_workspace.holidays.create!(name: "Collaborative occasion", date: 5.months.from_now)
    holiday.holiday_users.create!(user: owner, role: "owner")
    holiday.holiday_users.create!(user: @user, role: "collaborator")
    private_person = owner_workspace.people.create!(name: "Owner private contact", user: owner)
    shared_person = owner_workspace.people.create!(name: "Explicitly shared contact", user: owner)
    HolidayPerson.create!(holiday: holiday, person: shared_person)

    assert_no_difference("Gift.count") do
      result = call_tool("create_gift", {
        holiday_id: holiday.id,
        name: "Rejected private contact",
        recipient_ids: [ private_person.id ]
      })
      assert result["isError"]
    end

    assert_difference("Gift.count", 1) do
      result = call_tool("create_gift", {
        holiday_id: holiday.id,
        name: "Allowed shared contact",
        recipient_ids: [ shared_person.id ]
      })
      assert_not result["isError"], tool_payload(result).inspect
    end
  end

  test "create_gift enforces the free plan limit" do
    @user.update!(subscription_plan: "free", subscription_expires_at: nil)
    holiday = @workspace.holidays.create!(name: "Limit occasion", date: 4.months.from_now)
    holiday.holiday_users.create!(user: @user, role: "owner")
    status = GiftStatus.by_position.first!
    missing = [ User::FREE_GIFT_LIMIT - @user.gift_count, 0 ].max
    now = Time.current
    Gift.insert_all!(Array.new(missing) do |index|
      {
        holiday_id: holiday.id,
        gift_status_id: status.id,
        created_by_user_id: @user.id,
        name: "Limit filler #{index}",
        position: index,
        created_at: now,
        updated_at: now
      }
    end) if missing.positive?

    assert_no_difference("Gift.count") do
      result = call_tool("create_gift", { holiday_id: holiday.id, name: "Over the limit" })
      assert result["isError"]
      assert_match(/used all/, tool_payload(result).fetch("error"))
    end
  end

  test "validates advertised tool schemas before dispatch" do
    missing = call_tool("create_gift", { name: "Missing holiday" })
    assert missing["isError"]
    assert_match(/missing holiday_id/, tool_payload(missing).fetch("error"))

    wrong_type = call_tool("list_holidays", { workspace_id: "not-an-integer" })
    assert wrong_type["isError"]
    assert_match(/expected integer/, tool_payload(wrong_type).fetch("error"))

    holiday = @workspace.holidays.create!(name: "Schema limit holiday")
    holiday.holiday_users.create!(user: @user, role: "owner")
    assert_no_difference("Gift.count") do
      oversized = call_tool("create_gift", {
        holiday_id: holiday.id,
        name: "Too many recipients",
        recipient_ids: (1..101).to_a
      })
      assert oversized["isError"]
      assert_match(/too many items/, tool_payload(oversized).fetch("error"))
    end

    unknown = call_tool("list_workspaces", { unexpected: true })
    assert unknown["isError"]
    assert_match(/unknown unexpected/, tool_payload(unknown).fetch("error"))
  end

  test "creates and administers a wishlist and its items" do
    wishlist = tool_payload(call_tool("create_wishlist", {
      workspace_id: @workspace.id,
      name: "MCP Birthday List",
      visibility: "workspace",
      anti_spoiler_enabled: true
    }))

    item = tool_payload(call_tool("create_wishlist_item", {
      wishlist_id: wishlist.fetch("id"),
      name: "Noise-cancelling headphones",
      price_min: 200,
      priority: 2,
      quantity: 1
    }))

    assert_equal "Noise-cancelling headphones", item["name"]

    updated = tool_payload(call_tool("update_wishlist_item", {
      wishlist_id: wishlist.fetch("id"),
      item_id: item.fetch("id"),
      notes: "Black"
    }))
    assert_equal "Black", updated["notes"]

    shared = tool_payload(call_tool("share_wishlist", { wishlist_id: wishlist.fetch("id") }))
    assert_equal "shared", shared["visibility"]
    assert shared["share_url"].present?
  end

  test "creates and administers a gift exchange" do
    exchange = tool_payload(call_tool("create_gift_exchange", {
      workspace_id: @workspace.id,
      name: "MCP Secret Santa",
      exchange_date: "2026-12-20",
      budget_max: 75,
      include_creator: false
    }))

    assert_equal "MCP Secret Santa", exchange["name"]

    participant = tool_payload(call_tool("add_exchange_participant", {
      exchange_id: exchange.fetch("id"),
      name: "Taylor",
      email: "taylor-mcp@example.com"
    }))
    assert_equal "Taylor", participant["name"]

    updated = tool_payload(call_tool("update_exchange_participant", {
      exchange_id: exchange.fetch("id"),
      participant_id: participant.fetch("id"),
      name: "Taylor Updated"
    }))
    assert_equal "Taylor Updated", updated["name"]

    participants = tool_payload(call_tool("list_exchange_participants", {
      exchange_id: exchange.fetch("id")
    }))
    assert_equal 1, participants.length
    assert participants.first["invite_token"].present?
  end

  test "runs the private five-user exchange lifecycle through MCP roles" do
    exchange_json = tool_payload(call_tool("create_gift_exchange", {
      workspace_id: @workspace.id,
      name: "MCP Five User Exchange",
      include_creator: true
    }))
    exchange = GiftExchange.find(exchange_json.fetch("id"))

    participant_users = 4.times.map do |index|
      create_test_user(
        email: "mcp-participant-#{index}@example.com",
        clerk_id: "user_mcp_participant_#{index}"
      )
    end
    participant_headers = participant_users.map do |user|
      key = ApiKey.generate_for(user, name: "Exchange lifecycle", scopes: %w[read write])
      auth_headers(key.raw_key)
    end

    invited = participant_users.map.with_index do |user, index|
      tool_payload(call_tool("add_exchange_participant", {
        exchange_id: exchange.id,
        name: "Participant #{index + 1}",
        email: user.email
      }))
    end

    invited.zip(participant_headers).each do |participant, headers|
      accepted_exchange = tool_payload(call_tool(
        "accept_exchange_invite",
        { invite_token: participant.fetch("invite_token") },
        headers: headers
      ))
      assert_equal "participant", accepted_exchange["role"]
      assert accepted_exchange.dig("capabilities", "participate")
      refute accepted_exchange.dig("capabilities", "organize")
    end

    all_participants = exchange.reload.exchange_participants.order(:id).to_a
    [ [ 0, 1 ], [ 2, 3 ] ].each do |left_index, right_index|
      tool_payload(call_tool("add_exchange_exclusion", {
        exchange_id: exchange.id,
        participant_a_id: all_participants[left_index].id,
        participant_b_id: all_participants[right_index].id
      }))
    end

    published = tool_payload(call_tool("publish_gift_exchange", { exchange_id: exchange.id }))
    assert_equal "active", published["status"]
    assert_equal "organizer", published["role"]
    assert_equal %w[owner organizer participant matcher], published["roles"]
    assert published["published_at"].present?

    exclusions = tool_payload(call_tool("list_exchange_exclusions", {
      exchange_id: exchange.id
    }))
    assert_equal 2, exclusions.size

    late_invite = call_tool("add_exchange_participant", {
      exchange_id: exchange.id,
      name: "Too Late",
      email: "too-late-mcp@example.com"
    })
    assert late_invite["isError"]
    assert_equal "Published exchanges cannot be changed", tool_payload(late_invite)["error"]

    late_update = call_tool("update_gift_exchange", {
      exchange_id: exchange.id,
      name: "Changed After Publish"
    })
    assert late_update["isError"]
    assert_equal "Published exchanges cannot be changed", tool_payload(late_update)["error"]

    participant_roster = tool_payload(call_tool(
      "list_exchange_participants",
      { exchange_id: exchange.id },
      headers: participant_headers.first
    ))
    participant_roster.each do |participant|
      refute participant.key?("email")
      refute participant.key?("invite_token")
      refute participant.key?("matched_participant_id")
    end

    exchange.reload
    giver = exchange.exchange_participants.find_by!(user: participant_users.first)
    recipient = giver.matched_participant
    recipient_headers = if recipient.user_id == @user.id
      api_key_headers
    else
      participant_headers.fetch(participant_users.index(recipient.user))
    end

    tool_payload(call_tool(
      "create_exchange_wishlist_item",
      {
        exchange_id: exchange.id,
        participant_id: recipient.id,
        name: "MCP wishlist idea"
      },
      headers: recipient_headers
    ))

    giver_notifications = tool_payload(call_tool(
      "list_exchange_notifications",
      { exchange_id: exchange.id },
      headers: participant_headers.first
    ))
    assert_equal [ "wishlist_item_added" ], giver_notifications.pluck("kind")

    tool_payload(call_tool(
      "nudge_exchange_match",
      { exchange_id: exchange.id },
      headers: participant_headers.first
    ))
    recipient_notifications = tool_payload(call_tool(
      "list_exchange_notifications",
      { exchange_id: exchange.id },
      headers: recipient_headers
    ))
    assert_includes recipient_notifications.pluck("kind"), "wishlist_nudge"
    recipient_notifications.each do |notification|
      refute notification.key?("actor_id")
      refute notification.key?("recipient_participant_id")
    end

    first_draw = exchange.exchange_participants.pluck(:id, :matched_participant_id).to_h
    unauthorized_redraw = call_tool(
      "redo_gift_exchange",
      { exchange_id: exchange.id, mode: "redraw" },
      headers: participant_headers.first
    )
    assert unauthorized_redraw["isError"]

    redrawn = tool_payload(call_tool("redo_gift_exchange", {
      exchange_id: exchange.id,
      mode: "redraw"
    }))
    assert_equal "active", redrawn["status"]
    assert redrawn.dig("capabilities", "redo")
    exchange.reload.exchange_participants.each do |participant|
      refute_equal first_draw.fetch(participant.id), participant.matched_participant_id
    end
    assert_empty exchange.exchange_notifications

    reopened = tool_payload(call_tool("redo_gift_exchange", {
      exchange_id: exchange.id,
      mode: "reopen"
    }))
    assert_equal "inviting", reopened["status"]
    assert_nil reopened["published_at"]
    refute reopened.dig("capabilities", "redo")
    assert reopened.dig("capabilities", "publish")
    assert exchange.reload.exchange_participants.all? { |participant| participant.status == "accepted" }
    assert exchange.exchange_participants.none? { |participant| participant.matched_participant_id.present? }

    added_after_reopen = tool_payload(call_tool("add_exchange_participant", {
      exchange_id: exchange.id,
      name: "Added after reopen",
      email: "added-after-reopen@example.com"
    }))
    assert_equal "invited", added_after_reopen["status"]

    exclusion_to_replace = exchange.exchange_exclusions.first
    tool_payload(call_tool("remove_exchange_exclusion", {
      exchange_id: exchange.id,
      exclusion_id: exclusion_to_replace.id
    }))
    replacement_pair = exchange.exchange_participants.accepted.order(:id).last(2)
    replacement_exclusion = tool_payload(call_tool("add_exchange_exclusion", {
      exchange_id: exchange.id,
      participant_a_id: replacement_pair.first.id,
      participant_b_id: replacement_pair.last.id
    }))
    assert replacement_exclusion["id"].present?
  end

  test "returns MCP tool errors without leaking exceptions" do
    result = call_tool("get_gift_exchange", { exchange_id: "not-a-real-exchange" })

    assert result["isError"]
    assert_equal(
      "The requested record was not found or is not accessible",
      tool_payload(result)["error"]
    )
  end

  # Resource reads
  test "write-only credentials cannot list or read resources" do
    write_token = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "write" ],
      resource: "http://www.example.com/mcp"
    )

    write_key = ApiKey.generate_for(@user, name: "Write-only MCP Key", scopes: [ "write" ])
    credentials = [ write_token.token, write_key.raw_key ]
    requests = [
      { method: "resources/list", params: {} },
      { method: "resources/read", params: { uri: "listygifty://dashboard" } }
    ]

    credentials.product(requests).each do |credential, request_params|
      post "/mcp", params: {
        jsonrpc: "2.0",
        id: 1,
        **request_params
      }.to_json, headers: auth_headers(credential).merge("Content-Type" => "application/json")
      assert_response :success
      assert_equal(-32000, JSON.parse(response.body).dig("error", "code"))
    end
  end

  test "handles resources/read for dashboard" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "resources/read",
      params: { uri: "listygifty://dashboard" },
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert json["result"]["contents"].is_a?(Array)
    assert_equal "listygifty://dashboard", json["result"]["contents"].first["uri"]
  end

  test "billing resource uses active entitlement state" do
    @user.update!(subscription_plan: "premium", subscription_expires_at: 1.day.ago)
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "resources/read",
      params: { uri: "listygifty://billing" },
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    billing = JSON.parse(JSON.parse(response.body).dig("result", "contents", 0, "text"))
    assert_equal false, billing["is_premium"]
    assert_equal "expired", billing["subscription_status"]
  end

  test "returns error for unknown resource" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "resources/read",
      params: { uri: "unknown://resource" },
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal -32602, json["error"]["code"]
  end

  test "rejects oversized, deeply nested, and array request bodies safely" do
    post "/mcp", params: "x" * (McpController::MAX_REQUEST_BYTES + 1), headers: {
      "Authorization" => "Bearer #{@token_result.token}",
      "Content-Type" => "application/json",
      "CONTENT_LENGTH" => "0"
    }
    assert_response :content_too_large
    assert_equal "MCP request is too large", JSON.parse(response.body)["error"]

    post "/mcp", params: [].to_json, headers: auth_headers.merge("Content-Type" => "application/json")
    assert_response :bad_request
    assert_equal(-32600, JSON.parse(response.body).dig("error", "code"))

    post "/mcp", params: [ 1, "not-an-object" ].to_json,
      headers: auth_headers.merge("Content-Type" => "application/json")
    assert_response :bad_request
    assert_equal(-32600, JSON.parse(response.body).dig("error", "code"))

    nested = "{\"jsonrpc\":\"2.0\",\"method\":\"ping\",\"id\":1,\"params\":" +
      ("{\"x\":" * (McpController::MAX_JSON_DEPTH + 1)) + "null" +
      ("}" * (McpController::MAX_JSON_DEPTH + 1)) + "}"
    post "/mcp", params: nested, headers: auth_headers.merge("Content-Type" => "application/json")
    assert_response :success
    assert_equal(-32700, JSON.parse(response.body).dig("error", "code"))
  end

  test "rejects every JSON-RPC batch without executing calls or notifications" do
    assert_no_difference("Wishlist.count") do
      post "/mcp", params: [
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "create_wishlist",
            arguments: { workspace_id: @workspace.id, name: "Must not be created" }
          },
          id: 1
        },
        { jsonrpc: "2.0", method: "notifications/initialized" }
      ].to_json, headers: auth_headers.merge("Content-Type" => "application/json")
    end

    assert_response :bad_request
    assert_equal(-32600, JSON.parse(response.body).dig("error", "code"))
  end

  # Notifications (no id = no response)
  test "handles notifications without response" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :accepted
  end
end
