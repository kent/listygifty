require "test_helper"
require "minitest/mock"

class DemoSessionsControllerTest < ActionDispatch::IntegrationTest
  test "hands out a sign-in ticket for the demo email" do
    fake = Object.new
    def fake.sign_in_ticket! = "ticket-abc"

    DemoAccount.stub(:new, fake) do
      post "/demo_session", params: { email: " DEMO@listygifty.com" }, as: :json
    end

    assert_response :success
    assert_equal({ "ticket" => "ticket-abc" }, JSON.parse(response.body))
  end

  test "any other email gets nothing" do
    post "/demo_session", params: { email: users(:one).email }, as: :json

    assert_response :not_found
    assert_nil JSON.parse(response.body)["ticket"]
  end

  test "can be switched off" do
    previous = ENV["DEMO_ACCOUNT_ENABLED"]
    ENV["DEMO_ACCOUNT_ENABLED"] = "false"
    post "/demo_session", params: { email: DemoAccount::EMAIL }, as: :json

    assert_response :not_found
  ensure
    ENV["DEMO_ACCOUNT_ENABLED"] = previous
  end

  test "the demo account can look around the website but not change anything" do
    demo = User.create!(email: DemoAccount::EMAIL, clerk_user_id: "user_demo_web", first_name: "Demo")
    demo.ensure_personal_workspace!
    headers = auth_headers_for(demo)

    get "/wishlists", headers: headers
    assert_response :success

    post "/wishlists", params: { wishlist: { name: "Sneaky" } }.to_json, headers: headers
    assert_response :forbidden
    assert_not Wishlist.exists?(name: "Sneaky")

    post "/wishlists", params: { wishlist: { name: "Mine" } }.to_json, headers: auth_headers_for(users(:one))
    assert_response :created
  end

  test "the demo account can only use the apps MCP" do
    demo = User.create!(email: DemoAccount::EMAIL, clerk_user_id: "user_demo_mcp", first_name: "Demo")
    demo.ensure_personal_workspace!
    client = OauthClient.register_system_client(name: "Demo test", client_id: "demo-test", redirect_uris: [ "https://example.com/cb" ])
    list_tools = { jsonrpc: "2.0", method: "tools/list", id: 1 }.to_json

    { "/mcp" => :forbidden, "/apps/mcp" => :success }.each do |path, status|
      token = OauthAccessToken.generate_for(client: client, user: demo, scopes: %w[read write], resource: "http://www.example.com#{path}").token
      post path, params: list_tools, headers: { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" }
      assert_response status, path
    end
  end
end
