require "test_helper"

class ApiKeyScopeEnforcementTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @workspace = workspaces(:one)
    WorkspaceMembership.find_or_create_by!(user: @user, workspace: @workspace) { |membership| membership.role = "owner" }
  end

  test "read-only API key can read but cannot mutate product REST resources" do
    raw_key = ApiKey.generate_for(@user, name: "Read-only REST key", scopes: [ "read" ]).raw_key
    headers = api_key_headers(raw_key)

    get "/people", headers: headers, as: :json
    assert_response :success

    assert_no_difference("Person.count") do
      post "/people", params: { person: { name: "Unauthorized mutation" } }, headers: headers, as: :json
    end
    assert_response :forbidden
    assert_includes json_response["error"], "write"
  end

  test "write-only API key cannot read product REST resources" do
    raw_key = ApiKey.generate_for(@user, name: "Write-only REST key", scopes: [ "write" ]).raw_key

    get "/people", headers: api_key_headers(raw_key), as: :json

    assert_response :forbidden
    assert_includes json_response["error"], "read"
  end

  test "identity and billing endpoints require a Clerk browser session" do
    raw_key = ApiKey.generate_for(@user, name: "General REST key", scopes: %w[read write]).raw_key
    headers = api_key_headers(raw_key)

    get "/billing/status", headers: headers, as: :json
    assert_response :unauthorized
    post "/profile/sync", params: {}, headers: headers, as: :json
    assert_response :unauthorized
  end

  private

  def api_key_headers(raw_key)
    {
      "Authorization" => "Bearer #{raw_key}",
      "Content-Type" => "application/json",
      "X-Workspace-ID" => @workspace.id.to_s
    }
  end
end
