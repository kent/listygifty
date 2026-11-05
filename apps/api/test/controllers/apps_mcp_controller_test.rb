require "test_helper"

class AppsMcpControllerTest < ActionDispatch::IntegrationTest
  APPS_RESOURCE = "http://www.example.com/apps/mcp"

  setup do
    @user = users(:one)
    @workspace = workspaces(:one)
    WorkspaceMembership.find_or_create_by!(user: @user, workspace: @workspace) { |membership| membership.role = "owner" }
    @client = OauthClient.register_system_client(
      name: "Test Apps Client",
      client_id: "test-apps-client",
      redirect_uris: [ "https://example.com/callback" ]
    )
  end

  test "offers only the wishlist, Gift List, and exchange wishlist tools, each labelled" do
    tools = rpc("tools/list").dig("result", "tools")

    assert_equal AppsMcpController::TOOL_NAMES.sort, tools.pluck("name").sort
    %w[publish_gift_exchange delete_gift_exchange add_exchange_participant delete_wishlist claim_wishlist_item].each do |hidden|
      assert_not_includes tools.pluck("name"), hidden
    end
    tools.each do |tool|
      assert_operator tool["description"].length, :>=, 40, "#{tool["name"]} needs a fuller description"
      assert_equal %w[destructiveHint openWorldHint readOnlyHint], tool["annotations"].keys.sort, tool["name"]
    end
  end

  test "adds an item to the user's wishlist" do
    wishlist = Wishlist.create!(user: @user, workspace: @workspace, name: "Birthday")

    result = rpc("tools/call", name: "create_wishlist_item", arguments: { wishlist_id: wishlist.id, name: "Noise-cancelling headphones" })

    assert_not result.dig("result", "isError")
    assert_equal [ "Noise-cancelling headphones" ], wishlist.wishlist_items.pluck(:name)
  end

  test "refuses tools that are only on the full MCP" do
    exchange = GiftExchange.create!(workspace: @workspace, user: @user, name: "Family Draw", status: "inviting")

    result = rpc("tools/call", name: "delete_gift_exchange", arguments: { exchange_id: exchange.id })

    assert_equal "Unknown tool: delete_gift_exchange", result.dig("error", "message")
    assert GiftExchange.exists?(exchange.id)
  end

  test "has no resources" do
    assert_equal [], rpc("resources/list").dig("result", "resources")
  end

  test "a token for the full MCP does not work here" do
    full_token = OauthAccessToken.generate_for(
      client: @client, user: @user, scopes: %w[read write], resource: "http://www.example.com/mcp"
    ).token

    post "/apps/mcp", params: { jsonrpc: "2.0", method: "tools/list", id: 1 }.to_json,
      headers: { "Authorization" => "Bearer #{full_token}", "Content-Type" => "application/json" }

    assert_response :unauthorized
    assert_includes response.headers["WWW-Authenticate"], "/.well-known/oauth-protected-resource/apps/mcp"
  end

  test "accepts the 2025-11-25 protocol version" do
    post "/apps/mcp",
      params: { jsonrpc: "2.0", method: "initialize", id: 1, params: { protocolVersion: "2025-11-25", capabilities: {} } }.to_json,
      headers: auth_headers.merge("MCP-Protocol-Version" => "2025-11-25")

    assert_response :success
    assert_equal "2025-11-25", JSON.parse(response.body).dig("result", "protocolVersion")
  end

  private

  def rpc(method, params = {})
    post "/apps/mcp", params: { jsonrpc: "2.0", method: method, params: params, id: 1 }.to_json, headers: auth_headers
    assert_response :success
    JSON.parse(response.body)
  end

  def auth_headers
    @token ||= OauthAccessToken.generate_for(
      client: @client, user: @user, scopes: %w[read write], resource: APPS_RESOURCE
    ).token
    { "Authorization" => "Bearer #{@token}", "Content-Type" => "application/json" }
  end
end
