require "test_helper"

class OauthClientTest < ActiveSupport::TestCase
  test "generates client with credentials" do
    result = OauthClient.generate(
      name: "Test Client",
      redirect_uris: [ "https://example.com/callback" ]
    )

    assert result.client.persisted?
    assert_equal "Test Client", result.client.name
    assert result.client_id.present?
    assert_nil result.client_secret # Public client by default
  end

  test "generates confidential client with secret" do
    result = OauthClient.generate(
      name: "Confidential Client",
      redirect_uris: [ "https://example.com/callback" ],
      is_confidential: true
    )

    assert result.client.persisted?
    assert result.client_secret.present?
    assert result.client.confidential?
  end

  test "registers system client" do
    client = OauthClient.register_system_client(
      name: "Claude",
      client_id: "claude-test",
      redirect_uris: [ "https://claude.ai/callback" ]
    )

    assert client.persisted?
    assert client.is_system?
    assert_equal "claude-test", client.client_id
  end

  test "validates redirect_uris must be HTTPS for non-localhost" do
    client = OauthClient.new(
      name: "Test",
      client_id: SecureRandom.hex(16),
      redirect_uris: [ "http://example.com/callback" ]
    )

    assert_not client.valid?
    assert client.errors[:redirect_uris].any?
  end

  test "allows localhost redirect_uris without HTTPS" do
    client = OauthClient.new(
      name: "Test",
      client_id: SecureRandom.hex(16),
      redirect_uris: [ "http://localhost:3000/callback" ]
    )

    client.valid?
    assert_empty client.errors[:redirect_uris]
  end

  test "validates scopes" do
    client = OauthClient.new(
      name: "Test",
      client_id: SecureRandom.hex(16),
      redirect_uris: [ "https://example.com/callback" ],
      scopes: [ "invalid_scope" ]
    )

    assert_not client.valid?
    assert client.errors[:scopes].any?
  end

  test "dynamic registration creates client" do
    client = OauthClient.dynamic_register(
      client_name: "Dynamic Client",
      redirect_uris: [ "https://example.com/callback" ]
    )

    assert client.persisted?
    assert client.is_dynamic?
    assert_equal "Dynamic Client", client.name
  end

  test "verifies client secret correctly" do
    result = OauthClient.generate(
      name: "Confidential",
      redirect_uris: [ "https://example.com/callback" ],
      is_confidential: true
    )

    assert result.client.verify_secret(result.client_secret)
    assert_not result.client.verify_secret("wrong_secret")
  end

  test "revokes client" do
    result = OauthClient.generate(
      name: "Test",
      redirect_uris: [ "https://example.com/callback" ]
    )

    assert result.client.active?
    result.client.revoke!
    assert result.client.revoked?
    assert_not result.client.active?
  end

  test "validates redirect_uri" do
    result = OauthClient.generate(
      name: "Test",
      redirect_uris: [ "https://example.com/callback", "https://example.com/other" ]
    )

    assert result.client.valid_redirect_uri?("https://example.com/callback")
    assert_not result.client.valid_redirect_uri?("https://malicious.com/callback")
  end

  test "checks scope permissions" do
    result = OauthClient.generate(
      name: "Test",
      redirect_uris: [ "https://example.com/callback" ],
      scopes: [ "read" ]
    )

    assert result.client.can_request_scope?("read")
    assert_not result.client.can_request_scope?("write")
    assert_not result.client.can_request_scope?("admin")
  end
end
