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
