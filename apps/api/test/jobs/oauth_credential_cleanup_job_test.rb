require "test_helper"

class OauthCredentialCleanupJobTest < ActiveJob::TestCase
  setup do
    @user = users(:one)
  end

  test "removes expired OAuth artifacts and orphaned dynamic clients but preserves active grants" do
    orphan = dynamic_client("Orphan")
    orphan.update_columns(created_at: 25.hours.ago, updated_at: 25.hours.ago)
    recent_orphan = dynamic_client("Recent orphan")
    recent_orphan.update_columns(created_at: 23.hours.ago, updated_at: 23.hours.ago)

    transient_client = dynamic_client("Transient-only")
    transient_client.update_columns(created_at: 25.hours.ago, updated_at: 25.hours.ago)
    transient_request = OauthAuthorizationRequest.issue!(
      client: transient_client,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: "a" * 43,
      resource: "https://api.example.com/mcp"
    ).authorization_request
    transient_code = OauthAuthorizationCode.generate_for(
      client: transient_client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: "a" * 43,
      code_challenge_method: "S256",
      resource: "https://api.example.com/mcp"
    ).authorization_code

    expired_client = dynamic_client("Expired")
    expired_client.update_columns(created_at: 25.hours.ago, updated_at: 25.hours.ago)
    expired_token = OauthAccessToken.generate_for(
      client: expired_client,
      user: @user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    ).access_token
    expired_token.update_columns(expires_at: 2.hours.ago, refresh_token_expires_at: 1.hour.ago)
    expired_token.oauth_refresh_grant.update_column(:expires_at, 1.hour.ago)

    active_client = dynamic_client("Active")
    active_client.update_columns(created_at: 25.hours.ago, updated_at: 25.hours.ago)
    active_token = OauthAccessToken.generate_for(
      client: active_client,
      user: @user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    ).access_token
    expired_request = OauthAuthorizationRequest.issue!(
      client: active_client,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: "a" * 43,
      resource: "https://api.example.com/mcp"
    ).authorization_request
    expired_request.update_column(:expires_at, 1.minute.ago)
    expired_code = OauthAuthorizationCode.generate_for(
      client: active_client,
      user: @user,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: "a" * 43,
      code_challenge_method: "S256",
      resource: "https://api.example.com/mcp"
    ).authorization_code
    expired_code.update_column(:expires_at, 1.minute.ago)

    OauthCredentialCleanupJob.perform_now

    assert OauthClient.find(orphan.id).revoked_at.present?
    assert OauthClient.find(transient_client.id).revoked_at.present?
    assert OauthClient.find(expired_client.id).revoked_at.present?
    assert OauthClient.find(recent_orphan.id).revoked_at.nil?
    assert OauthAuthorizationRequest.exists?(transient_request.id)
    assert OauthAuthorizationCode.exists?(transient_code.id)
    assert_not OauthAccessToken.exists?(expired_token.id)
    assert_not OauthAuthorizationRequest.exists?(expired_request.id)
    assert_not OauthAuthorizationCode.exists?(expired_code.id)
    assert OauthClient.find(active_client.id).revoked_at.nil?
    assert OauthAccessToken.exists?(active_token.id)

    travel 16.minutes do
      OauthCredentialCleanupJob.perform_now
    end

    assert_not OauthClient.exists?(orphan.id)
    assert_not OauthClient.exists?(transient_client.id)
    assert_not OauthAuthorizationRequest.exists?(transient_request.id)
    assert_not OauthAuthorizationCode.exists?(transient_code.id)
    assert_not OauthClient.exists?(expired_client.id)
    assert OauthClient.exists?(recent_orphan.id)
    assert OauthClient.exists?(active_client.id)
    assert OauthAccessToken.exists?(active_token.id)
  end

  test "purges revoked refresh families after a replay drain" do
    old_client = dynamic_client("Revoked old family")
    old = OauthAccessToken.generate_for(
      client: old_client,
      user: @user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    ).access_token
    draft, = AdminEmailDraft.create_with_confirmation!(
      created_by: @user,
      recipient: @user,
      credential: old,
      subject: "Audit reference",
      body: "Body"
    )
    old_grant = old.oauth_refresh_grant
    old_grant.revoke_family!
    old_grant.update_columns(revoked_at: 2.hours.ago, updated_at: 2.hours.ago)

    recent_client = dynamic_client("Recently revoked family")
    recent = OauthAccessToken.generate_for(
      client: recent_client,
      user: @user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    ).access_token
    recent_grant = recent.oauth_refresh_grant
    recent_grant.revoke_family!

    OauthCredentialCleanupJob.perform_now

    assert_not OauthAccessToken.exists?(old.id)
    assert_not OauthRefreshGrant.exists?(old_grant.id)
    assert_nil draft.reload.oauth_access_token_id
    assert OauthAccessToken.exists?(recent.id)
    assert OauthRefreshGrant.exists?(recent_grant.id)
  end

  private

  def dynamic_client(name)
    OauthClient.dynamic_register(
      client_name: name,
      redirect_uris: [ "https://example.com/callback" ],
      scopes: [ "read" ]
    )
  end
end
