require "test_helper"

class OauthConnectionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @other_user = users(:two)
    @client = OauthClient.create!(
      client_id: "connected-client",
      name: "Claude Desktop",
      redirect_uris: [ "https://claude.ai/api/mcp/auth_callback" ],
      scopes: %w[read write],
      is_system: true
    )
  end

  test "lists current user oauth connections" do
    create_token(user: @user, scopes: %w[read], last_used_at: 2.hours.ago)
    create_token(user: @user, scopes: %w[write], refresh_token_expires_at: 10.days.from_now)
    create_token(user: @other_user, client: @client)

    get "/oauth/connections", headers: auth_headers_for(@user), as: :json

    assert_response :success
    assert_equal 1, json_response.length

    connection = json_response.first
    assert_equal "Claude Desktop", connection["client_name"]
    assert_equal "connected-client", connection["client_id"]
    assert_equal %w[read write], connection["scopes"]
    assert_not_nil connection["created_at"]
    assert_not_nil connection["last_used_at"]
    assert_not_nil connection["expires_at"]
  end

  test "does not list expired oauth connections" do
    create_token(user: @user, expires_at: 2.hours.ago, refresh_token_expires_at: 1.hour.ago)

    get "/oauth/connections", headers: auth_headers_for(@user), as: :json

    assert_response :success
    assert_equal [], json_response
  end

  test "does not list revoked oauth clients" do
    @client.revoke!
    create_token(user: @user)

    get "/oauth/connections", headers: auth_headers_for(@user), as: :json

    assert_response :success
    assert_equal [], json_response
  end

  test "revokes current user tokens for connected client" do
    token = create_token(user: @user)
    other_token = create_token(user: @other_user, client: @client)

    delete "/oauth/connections/connected-client", headers: auth_headers_for(@user), as: :json

    assert_response :no_content
    assert token.reload.revoked?
    assert_not other_token.reload.revoked?
  end

  test "returns not found when connected client is absent" do
    delete "/oauth/connections/missing-client", headers: auth_headers_for(@user), as: :json

    assert_response :not_found
    assert_equal "Connected app not found", json_response["error"]
  end

  private

  def create_token(
    user:,
    client: @client,
    scopes: %w[read write],
    expires_at: 1.hour.from_now,
    refresh_token_expires_at: 30.days.from_now,
    last_used_at: nil
  )
    OauthAccessToken.create!(
      oauth_client: client,
      user: user,
      token_hash: Digest::SHA256.hexdigest(SecureRandom.hex(16)),
      refresh_token_hash: Digest::SHA256.hexdigest(SecureRandom.hex(24)),
      scopes: scopes,
      expires_at: expires_at,
      refresh_token_expires_at: refresh_token_expires_at,
      last_used_at: last_used_at
    )
  end
end
