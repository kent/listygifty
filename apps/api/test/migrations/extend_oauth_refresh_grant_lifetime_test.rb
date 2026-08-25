require "test_helper"
require Rails.root.join("db/migrate/20260825000000_extend_oauth_refresh_grant_lifetime").to_s

class ExtendOauthRefreshGrantLifetimeTest < ActiveSupport::TestCase
  RESOURCE = "https://api.example.com/mcp"

  setup do
    @user = users(:one)
    @client = OauthClient.dynamic_register(
      client_name: "Migration test client",
      redirect_uris: [ "https://example.com/callback" ],
      scopes: %w[read write]
    )
  end

  test "extends only active grants and is idempotent" do
    active = generate
    active_created_at = 10.days.ago
    active_old_expiry = 20.days.from_now
    set_lifetime(active, created_at: active_created_at, expires_at: active_old_expiry)

    expired = generate
    expired_old_expiry = 10.days.ago
    set_lifetime(expired, created_at: 40.days.ago, expires_at: expired_old_expiry)

    revoked = generate
    revoked_old_expiry = 20.days.from_now
    set_lifetime(revoked, created_at: 10.days.ago, expires_at: revoked_old_expiry)
    revoked.access_token.oauth_refresh_grant.update_columns(revoked_at: Time.current)

    migration.up

    active_grant = active.access_token.oauth_refresh_grant.reload
    assert_in_delta active_created_at + 1.year, active_grant.expires_at, 1.second
    assert_equal active_grant.expires_at, active.access_token.reload.refresh_token_expires_at

    assert_in_delta expired_old_expiry, expired.access_token.oauth_refresh_grant.reload.expires_at, 1.second
    assert_in_delta expired_old_expiry, expired.access_token.reload.refresh_token_expires_at, 1.second
    assert expired.access_token.refresh_token_expired?
    assert_raises(OauthError) { expired.access_token.refresh! }

    assert_in_delta revoked_old_expiry, revoked.access_token.oauth_refresh_grant.reload.expires_at, 1.second

    first_extended_expiry = active_grant.expires_at
    migration.up
    assert_equal first_extended_expiry, active_grant.reload.expires_at
  end

  private

  def generate
    OauthAccessToken.generate_for(
      client: @client,
      user: @user,
      scopes: [ "read" ],
      resource: RESOURCE
    )
  end

  def set_lifetime(result, created_at:, expires_at:)
    result.access_token.oauth_refresh_grant.update_columns(
      created_at: created_at,
      expires_at: expires_at
    )
    result.access_token.update_columns(refresh_token_expires_at: expires_at)
  end

  def migration
    ExtendOauthRefreshGrantLifetime.new
  end
end
