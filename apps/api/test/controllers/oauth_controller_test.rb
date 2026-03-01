require "test_helper"

class OauthControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user = users(:one)
    @client = OauthClient.register_system_client(
      name: "Test Client",
      client_id: "test-oauth-client",
      redirect_uris: ["https://example.com/callback", "http://localhost:3000/callback"]
    )
  end

  # Authorization endpoint tests
  test "authorize returns error for unknown client" do
    get "/oauth/authorize", params: {
      client_id: "unknown",
      redirect_uri: "https://example.com/callback",
      response_type: "code"
    }

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "invalid_client", json["error"]
  end

  test "authorize returns error for invalid redirect_uri" do
    get "/oauth/authorize", params: {
      client_id: @client.client_id,
      redirect_uri: "https://malicious.com/callback",
      response_type: "code"
    }

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "invalid_request", json["error"]
  end

  test "authorize returns error for unsupported response_type" do
    get "/oauth/authorize", params: {
      client_id: @client.client_id,
      redirect_uri: "https://example.com/callback",
      response_type: "token"
    }

    # Should redirect with error
    assert_response :redirect
    assert response.location.include?("error=unsupported_response_type")
  end

  # Dynamic client registration tests
  test "register creates new client" do
    post "/oauth/register", params: {
      client_name: "New App",
      redirect_uris: ["https://newapp.com/callback"]
    }, as: :json

    assert_response :created
    json = JSON.parse(response.body)

    assert json["client_id"].present?
    assert_equal "New App", json["client_name"]
    assert_equal ["https://newapp.com/callback"], json["redirect_uris"]
  end

  test "register fails without redirect_uris" do
    post "/oauth/register", params: {
      client_name: "No Redirect"
    }, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "invalid_client_metadata", json["error"]
  end

  # Token endpoint tests
  test "token fails with invalid grant_type" do
    post "/oauth/token", params: {
      grant_type: "password",
      username: "test",
      password: "test"
    }, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "unsupported_grant_type", json["error"]
  end

  test "token fails with invalid authorization code" do
    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: "invalid_code",
      client_id: @client.client_id,
      redirect_uri: "https://example.com/callback"
    }, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "invalid_grant", json["error"]
  end

  test "token exchanges valid authorization code" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    auth_code_result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read", "write"],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: auth_code_result.code,
      client_id: @client.client_id,
      redirect_uri: "https://example.com/callback",
      code_verifier: code_verifier
    }, as: :json

    assert_response :success
    json = JSON.parse(response.body)

    assert json["access_token"].present?
    assert_equal "Bearer", json["token_type"]
    assert json["expires_in"] > 0
    assert json["refresh_token"].present?
  end

  test "token fails with wrong PKCE verifier" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    auth_code_result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read"],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    post "/oauth/token", params: {
      grant_type: "authorization_code",
      code: auth_code_result.code,
      client_id: @client.client_id,
      redirect_uri: "https://example.com/callback",
      code_verifier: "wrong_verifier"
    }, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "invalid_grant", json["error"]
  end

  test "token refresh works with valid refresh token" do
    token_result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: ["read", "write"]
    )

    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: token_result.refresh_token,
      client_id: @client.client_id
    }, as: :json

    assert_response :success
    json = JSON.parse(response.body)

    assert json["access_token"].present?
    assert json["refresh_token"].present?
    assert_not_equal token_result.token, json["access_token"]
    assert_not_equal token_result.refresh_token, json["refresh_token"]
  end

  test "token refresh fails with invalid refresh token" do
    post "/oauth/token", params: {
      grant_type: "refresh_token",
      refresh_token: "invalid_refresh_token",
      client_id: @client.client_id
    }, as: :json

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal "invalid_grant", json["error"]
  end

  # Revocation tests
  test "revoke successfully revokes access token" do
    token_result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: ["read"]
    )

    post "/oauth/revoke", params: {
      token: token_result.token,
      token_type_hint: "access_token"
    }, as: :json

    assert_response :success
    assert token_result.access_token.reload.revoked?
  end

  test "revoke returns 200 for invalid token" do
    post "/oauth/revoke", params: {
      token: "invalid_token"
    }, as: :json

    # Per RFC 7009, always return 200
    assert_response :success
  end
end
