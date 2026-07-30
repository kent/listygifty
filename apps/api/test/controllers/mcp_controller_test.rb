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
      scopes: [ "read", "write" ]
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
    assert response.headers["WWW-Authenticate"].include?("resource_metadata")
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

  # Batch requests
  test "handles batch requests" do
    post "/mcp", params: [
      { jsonrpc: "2.0", method: "ping", id: 1 },
      { jsonrpc: "2.0", method: "tools/list", id: 2 }
    ].to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert json.is_a?(Array)
    assert_equal 2, json.length
    assert json.any? { |r| r["id"] == 1 && r["result"]["pong"] }
    assert json.any? { |r| r["id"] == 2 && r["result"]["tools"] }
  end

  # Notifications (no id = no response)
  test "handles notifications without response" do
    post "/mcp", params: {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :no_content
  end
end
