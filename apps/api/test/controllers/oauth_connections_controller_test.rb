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

  test "API keys cannot inspect or revoke OAuth connections" do
    token = create_token(user: @user)
    api_key = ApiKey.generate_for(@user, name: "Connection key", scopes: %w[read write]).raw_key
    headers = { "Authorization" => "Bearer #{api_key}" }

    get "/oauth/connections", headers: headers, as: :json
    assert_response :unauthorized
    delete "/oauth/connections/connected-client", headers: headers, as: :json
    assert_response :unauthorized
    assert token.reload.revoked_at.nil?
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

  test "does not list version-one legacy OAuth connections" do
    token = create_token(user: @user)
    token.update_column(:credential_version, 1)

    get "/oauth/connections", headers: auth_headers_for(@user), as: :json

    assert_response :success
    assert_equal [], json_response
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

  test "reports refresh grant scopes when the current access token is narrowed" do
    token = create_token(user: @user, scopes: %w[read write])
    token.update_column(:scopes, [ "read" ])

    get "/oauth/connections", headers: auth_headers_for(@user), as: :json

    assert_response :success
    connection = json_response.find { |item| item["client_id"] == "connected-client" }
    assert_equal %w[read write], connection["scopes"]
  end

  test "revokes current user tokens for connected client" do
    token = create_token(user: @user)
    other_token = create_token(user: @other_user, client: @client)

    delete "/oauth/connections/connected-client", headers: auth_headers_for(@user), as: :json

    assert_response :no_content
    assert token.reload.revoked?
    assert token.oauth_refresh_grant.reload.revoked_at.present?
    assert_not other_token.reload.revoked?
  end

  test "disconnect invalidates withheld codes and bound pending consent requests" do
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
    code_attributes = {
      client: @client,
      user: @user,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      scopes: [ "read" ],
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: "http://www.example.com/mcp"
    }
    exchanged = OauthAuthorizationCode.generate_for(**code_attributes)
    withheld = OauthAuthorizationCode.generate_for(**code_attributes)
    exchanged.authorization_code.exchange!(code_verifier: verifier)
    pending = OauthAuthorizationRequest.issue!(
      client: @client,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      scopes: [ "read" ],
      code_challenge: challenge,
      resource: "http://www.example.com/mcp"
    )
    pending.authorization_request.claim!(@user)

    delete "/oauth/connections/connected-client", headers: auth_headers_for(@user), as: :json
    assert_response :no_content

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: withheld.code,
      client_id: @client.client_id,
      code_verifier: verifier,
      resource: "http://www.example.com/mcp"
    }, as: :json
    assert_response :bad_request
    assert_equal "invalid_grant", json_response["error"]
    assert_raises(OauthError) { pending.authorization_request.reload.claim!(@user) }
    assert pending.authorization_request.reload.consumed?
  end

  test "can revoke a legacy token row that predates refresh grant families" do
    token = create_token(user: @user)
    token.update_column(:oauth_refresh_grant_id, nil)

    delete "/oauth/connections/connected-client", headers: auth_headers_for(@user), as: :json

    assert_response :no_content
    assert token.reload.revoked?
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
    grant = OauthRefreshGrant.create!(
      family_id: SecureRandom.uuid,
      oauth_client: client,
      user: user,
      scopes: scopes,
      resource: "http://www.example.com/mcp",
      expires_at: refresh_token_expires_at
    )
    OauthAccessToken.create!(
      oauth_client: client,
      user: user,
      token_hash: Digest::SHA256.hexdigest(SecureRandom.hex(16)),
      refresh_token_hash: Digest::SHA256.hexdigest(SecureRandom.hex(24)),
      scopes: scopes,
      resource: "http://www.example.com/mcp",
      oauth_refresh_grant: grant,
      expires_at: expires_at,
      refresh_token_expires_at: refresh_token_expires_at,
      last_used_at: last_used_at
    )
  end
end
