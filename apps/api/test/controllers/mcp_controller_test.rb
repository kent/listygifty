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
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" }
      },
      id: 1
    }.to_json, headers: auth_headers.merge("Content-Type" => "application/json")

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "2024-11-05", json["result"]["protocolVersion"]
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
