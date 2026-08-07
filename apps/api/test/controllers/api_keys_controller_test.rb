require "test_helper"

class ApiKeysControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
  end

  test "creates an API key from the nested web request" do
    assert_difference -> { @user.api_keys.count }, 1 do
      post "/api_keys",
        params: { api_key: { name: "Runner", scopes: %w[read write] } },
        headers: auth_headers_for(@user),
        as: :json
    end

    assert_response :created
    assert_equal "Runner", json_response.dig("api_key", "name")
    assert_equal %w[read write], json_response.dig("api_key", "scopes")
    assert json_response["raw_key"].start_with?("ng_")
    assert ApiKey.find_by_raw_key(json_response["raw_key"])
  end

  test "uses read and write scopes by default" do
    post "/api_keys",
      params: { api_key: { name: "Default scopes" } },
      headers: auth_headers_for(@user),
      as: :json

    assert_response :created
    assert_equal %w[read write], json_response.dig("api_key", "scopes")
  end

  test "returns validation errors for a blank name" do
    post "/api_keys",
      params: { api_key: { name: "", scopes: %w[read write] } },
      headers: auth_headers_for(@user),
      as: :json

    assert_response :unprocessable_entity
    assert_includes json_response["errors"], "Name can't be blank"
  end

  test "only the allowlisted administrator can create a dedicated expiring admin key" do
    post "/api_keys",
      params: { api_key: { name: "Forbidden admin", scopes: %w[admin] } },
      headers: auth_headers_for(@user),
      as: :json
    assert_response :forbidden

    admin = User.create!(email: Admin::Authorization::DEFAULT_ADMIN_EMAIL, clerk_user_id: "api_key_admin", subscription_plan: "free")
    post "/api_keys",
      params: { api_key: { name: "Admin MCP", scopes: %w[admin] } },
      headers: auth_headers_for(admin),
      as: :json
    assert_response :created
    assert_equal [ "admin" ], json_response.dig("api_key", "scopes")
    assert Time.iso8601(json_response.dig("api_key", "expires_at")) <= 30.days.from_now + 1.minute
  end
end
