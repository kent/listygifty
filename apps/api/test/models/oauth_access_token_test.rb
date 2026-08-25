require "test_helper"

class OauthAccessTokenTest < ActiveSupport::TestCase
  RESOURCE = "https://api.example.com/mcp"
  def setup
    @user = users(:one)
    @client = OauthClient.register_system_client(
      name: "Test Client",
      client_id: "test-client-#{SecureRandom.hex(4)}",
      redirect_uris: [ "https://example.com/callback" ]
    )
  end

  test "generates access token with refresh token" do
    result = generate(
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
    result = generate(
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
    result = generate(
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
    result = generate(
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

  test "refresh token grant remains active for one year" do
    result = generate(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    travel 364.days do
      assert_not result.access_token.refresh_token_expired?
    end

    travel 366.days do
      assert result.access_token.refresh_token_expired?
    end
  end

  test "refreshes token and rotates refresh token" do
    result = generate(
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

  test "bounds rapid refresh rotation and total family storage" do
    original = generate(scopes: [ "read" ])
    current = original.access_token.refresh!
    grant = current.access_token.oauth_refresh_grant
    assert_equal 1, grant.reload.rotation_count

    assert_no_difference("OauthAccessToken.count") do
      error = assert_raises(OauthError) { current.access_token.refresh! }
      assert_equal "temporarily_unavailable", error.error_code
    end
    assert current.access_token.reload.active?

    travel OauthRefreshGrant::MIN_ROTATION_INTERVAL + 1.second do
      next_result = current.access_token.refresh!
      assert_equal 2, next_result.access_token.oauth_refresh_grant.reload.rotation_count
    end

    grant.update_columns(rotation_count: OauthRefreshGrant::MAX_ROTATIONS, last_rotated_at: nil)
    active = grant.oauth_access_tokens.where(revoked_at: nil).first!
    error = assert_raises(OauthError) { active.refresh! }
    assert_equal "invalid_grant", error.error_code
    assert grant.reload.revoked_at.present?
  end

  test "detects rotated refresh token replay and durably revokes its active family" do
    original = generate(scopes: [ "read", "write" ])
    deadline = original.access_token.refresh_token_expires_at
    grant = original.access_token.oauth_refresh_grant

    current = original.access_token.refresh!
    assert_equal grant.id, current.access_token.oauth_refresh_grant_id
    assert_equal deadline, current.access_token.refresh_token_expires_at
    assert current.access_token.active?

    error = assert_raises(OauthError) { original.access_token.refresh! }
    assert_includes error.message, "reuse detected"
    assert current.access_token.reload.revoked?
    assert_nil OauthAccessToken.find_by_token(current.token)
  end

  test "fails refresh when token revoked" do
    result = generate(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    result.access_token.revoke!

    assert_raises(OauthError) do
      result.access_token.refresh!
    end
  end

  test "fails refresh when the one-year refresh grant expires" do
    result = generate(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    travel 366.days do
      assert_raises(OauthError) do
        result.access_token.refresh!
      end
    end
  end

  test "checks scope permissions" do
    result = generate(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    assert result.access_token.can?("read")
    assert_not result.access_token.can?("write")
  end

  test "generates token response" do
    result = generate(
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
    result = generate(
      client: @client,
      user: @user,
      scopes: [ "read" ]
    )

    assert_nil result.access_token.last_used_at

    result.access_token.touch_last_used!

    assert_not_nil result.access_token.reload.last_used_at
  end

  test "stores resource for audience validation" do
    result = generate(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    )

    assert_equal "https://api.example.com/mcp", result.access_token.resource
  end
  private

  def generate(**options)
    defaults = {
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: RESOURCE
    }
    OauthAccessToken.generate_for(**defaults.merge(options))
  end
end
