require "test_helper"

class OauthAuthorizationCodeTest < ActiveSupport::TestCase
  def setup
    @user = users(:one)
    @client = OauthClient.register_system_client(
      name: "Test Client",
      client_id: "test-client-#{SecureRandom.hex(4)}",
      redirect_uris: ["https://example.com/callback"]
    )
  end

  test "generates authorization code" do
    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read", "write"],
      code_challenge: Base64.urlsafe_encode64(Digest::SHA256.digest("test_verifier"), padding: false),
      code_challenge_method: "S256"
    )

    assert result.authorization_code.persisted?
    assert result.code.present?
    assert_equal @user, result.authorization_code.user
    assert_equal @client, result.authorization_code.oauth_client
  end

  test "finds authorization code by raw code" do
    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read"],
      code_challenge: Base64.urlsafe_encode64(Digest::SHA256.digest("test_verifier"), padding: false),
      code_challenge_method: "S256"
    )

    found = OauthAuthorizationCode.find_by_code(result.code)
    assert_equal result.authorization_code, found
  end

  test "returns nil for invalid code" do
    found = OauthAuthorizationCode.find_by_code("invalid_code")
    assert_nil found
  end

  test "code expires after 10 minutes" do
    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read"],
      code_challenge: Base64.urlsafe_encode64(Digest::SHA256.digest("test_verifier"), padding: false),
      code_challenge_method: "S256"
    )

    assert_not result.authorization_code.expired?

    travel 11.minutes do
      assert result.authorization_code.expired?
    end
  end

  test "exchanges code for token with valid PKCE" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read", "write"],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    token_result = result.authorization_code.exchange!(code_verifier: code_verifier)

    assert token_result.access_token.persisted?
    assert token_result.token.present?
    assert token_result.refresh_token.present?
    assert result.authorization_code.used?
  end

  test "fails exchange with invalid PKCE verifier" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read"],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    assert_raises(OauthError) do
      result.authorization_code.exchange!(code_verifier: "wrong_verifier")
    end
  end

  test "fails exchange when code already used" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read"],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    result.authorization_code.exchange!(code_verifier: code_verifier)

    assert_raises(OauthError) do
      result.authorization_code.exchange!(code_verifier: code_verifier)
    end
  end

  test "fails exchange when code expired" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    result = OauthAuthorizationCode.generate_for(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: ["read"],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    travel 11.minutes do
      assert_raises(OauthError) do
        result.authorization_code.exchange!(code_verifier: code_verifier)
      end
    end
  end
end
