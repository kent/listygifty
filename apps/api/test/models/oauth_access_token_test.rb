require "test_helper"

class OauthAccessTokenTest < ActiveSupport::TestCase
  def setup
    @user = users(:one)
    @client = OauthClient.register_system_client(
      name: "Test Client",
      client_id: "test-client-#{SecureRandom.hex(4)}",
      redirect_uris: [ "https://example.com/callback" ]
    )
  end

  test "generates access token with refresh token" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read", "write" ]
    )

    assert result.access_token.persisted?
    assert result.token.present?
    assert result.refresh_token.present?
    assert_equal @user, result.access_token.user
    assert_equal @client, result.access_token.oauth_client
  end

  test "generates access token without refresh token" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      include_refresh: false
    )

    assert result.access_token.persisted?
    assert result.token.present?
    assert_nil result.refresh_token
  end

  test "finds token by raw value" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    found = OauthAccessToken.find_by_token(result.token)
    assert_equal result.access_token, found
  end

  test "returns nil for invalid token" do
    found = OauthAccessToken.find_by_token("invalid_token")
    assert_nil found
  end

  test "token expires after 1 hour" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    assert result.access_token.active?

    travel 61.minutes do
      assert result.access_token.expired?
      assert_not result.access_token.active?
    end
  end

  test "refresh token expires after 30 days" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    assert_not result.access_token.refresh_token_expired?

    travel 31.days do
      assert result.access_token.refresh_token_expired?
    end
  end

  test "refreshes token and rotates refresh token" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read", "write" ]
    )

    old_token = result.access_token

    new_result = old_token.refresh!

    assert new_result.access_token.persisted?
    assert_not_equal old_token.id, new_result.access_token.id
    assert old_token.reload.revoked?
    assert new_result.token.present?
    assert new_result.refresh_token.present?
  end

  test "fails refresh when token revoked" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    result.access_token.revoke!

    assert_raises(OauthError) do
      result.access_token.refresh!
    end
  end

  test "fails refresh when refresh token expired" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    travel 31.days do
      assert_raises(OauthError) do
        result.access_token.refresh!
      end
    end
  end

  test "checks scope permissions" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    assert result.access_token.can?("read")
    assert_not result.access_token.can?("write")
  end

  test "generates token response" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read", "write" ]
    )

    response = result.access_token.to_token_response(result.token, result.refresh_token)

    assert_equal result.token, response[:access_token]
    assert_equal "Bearer", response[:token_type]
    assert response[:expires_in] > 0
    assert_equal "read write", response[:scope]
    assert_equal result.refresh_token, response[:refresh_token]
  end

  test "touches last_used_at" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    assert_nil result.access_token.last_used_at

    result.access_token.touch_last_used!

    assert_not_nil result.access_token.reload.last_used_at
  end

  test "stores resource for audience validation" do
    result = OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    )

    assert_equal "https://api.example.com/mcp", result.access_token.resource
  end
end
