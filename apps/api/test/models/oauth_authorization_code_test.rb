require "test_helper"

class OauthAuthorizationCodeTest < ActiveSupport::TestCase
  RESOURCE = "https://api.example.com/mcp"

  def setup
    @user = users(:one)
    @client = OauthClient.register_system_client(
      name: "Test Client",
      client_id: "test-client-#{SecureRandom.hex(4)}",
      redirect_uris: [ "https://example.com/callback" ]
    )
  end

  test "generates authorization code" do
    result = generate_code(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read", "write" ],
      code_challenge: Base64.urlsafe_encode64(Digest::SHA256.digest("test_verifier"), padding: false),
      code_challenge_method: "S256"
    )

    assert result.authorization_code.persisted?
    assert result.code.present?
    assert_equal @user, result.authorization_code.user
    assert_equal @client, result.authorization_code.oauth_client
  end

  test "finds authorization code by raw code" do
    result = generate_code(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: Base64.urlsafe_encode64(Digest::SHA256.digest("test_verifier"), padding: false),
      code_challenge_method: "S256"
    )

    found = OauthAuthorizationCode.find_by_code(result.code)
    assert_equal result.authorization_code, found

    result.authorization_code.update_column(:credential_version, 1)
    assert_nil OauthAuthorizationCode.find_by_code(result.code)
  end

  test "returns nil for invalid code" do
    found = OauthAuthorizationCode.find_by_code("invalid_code")
    assert_nil found
  end

  test "code expires after 10 minutes" do
    result = generate_code(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
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

    result = generate_code(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read", "write" ],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    token_result = result.authorization_code.exchange!(code_verifier: code_verifier)

    assert token_result.access_token.persisted?
    assert token_result.token.present?
    assert token_result.refresh_token.present?
    assert result.authorization_code.used?
    assert_equal result.authorization_code, token_result.access_token.oauth_authorization_code
  end

  test "issuance marker prevents retirement after a successful dynamic-client exchange" do
    client = OauthClient.dynamic_register(
      client_name: "Old dynamic client",
      redirect_uris: [ "https://example.com/callback" ],
      scopes: [ "read" ]
    )
    client.update_columns(created_at: 25.hours.ago, updated_at: 25.hours.ago)
    verifier = SecureRandom.urlsafe_base64(32)
    code = generate_code(
      client: client,
      code_challenge: Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false),
      code_challenge_method: "S256"
    ).authorization_code

    token = code.exchange!(code_verifier: verifier).access_token
    grant = token.oauth_refresh_grant
    token.destroy!
    grant.destroy!
    OauthCredentialCleanupJob.new.send(:retire_orphaned_dynamic_clients, Time.current)

    assert client.reload.active?
    assert client.updated_at > 1.minute.ago
  end

  test "a client revoked after code load stays revoked and cannot mint" do
    verifier = SecureRandom.urlsafe_base64(32)
    code = generate_code(
      code_challenge: Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false),
      code_challenge_method: "S256"
    ).authorization_code
    code.oauth_client # Cache the formerly active client association.
    @client.revoke!

    assert_no_difference("OauthAccessToken.count") do
      error = assert_raises(OauthError) { code.exchange!(code_verifier: verifier) }
      assert_equal "invalid_grant", error.error_code
    end
    assert @client.reload.revoked?
  end

  test "fails exchange with invalid PKCE verifier" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    result = generate_code(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
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

    result = generate_code(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    token_result = result.authorization_code.exchange!(code_verifier: code_verifier)

    assert_raises(OauthError) do
      result.authorization_code.exchange!(code_verifier: "x" * 43)
    end
    assert token_result.access_token.reload.revoked_at.nil?
    assert token_result.access_token.oauth_refresh_grant.reload.revoked_at.nil?

    error = assert_raises(OauthError) do
      result.authorization_code.exchange!(code_verifier: code_verifier)
    end
    assert_includes error.error_description, "replay detected"
    assert token_result.access_token.reload.revoked?
    assert token_result.access_token.oauth_refresh_grant.reload.revoked_at.present?
  end

  test "expired used code replay does not revoke issued credentials" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)
    result = generate_code(
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )
    token_result = result.authorization_code.exchange!(code_verifier: code_verifier)

    travel 11.minutes do
      assert_raises(OauthError) do
        result.authorization_code.exchange!(code_verifier: code_verifier)
      end
    end

    assert token_result.access_token.reload.revoked_at.nil?
    assert token_result.access_token.oauth_refresh_grant.reload.revoked_at.nil?
  end

  test "fails exchange when code expired" do
    code_verifier = SecureRandom.urlsafe_base64(32)
    code_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)

    result = generate_code(
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: code_challenge,
      code_challenge_method: "S256"
    )

    travel 11.minutes do
      assert_raises(OauthError) do
        result.authorization_code.exchange!(code_verifier: code_verifier)
      end
    end
  end

  private

  def generate_code(**options)
    defaults = {
      client: @client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      resource: RESOURCE
    }
    OauthAuthorizationCode.generate_for(**defaults.merge(options))
  end
end
