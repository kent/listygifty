require "test_helper"

class OauthRefreshReplayTest < ActiveSupport::TestCase
  self.use_transactional_tests = false

  test "ancestor replay serializes against descendant refresh and revokes the durable family" do
    user = User.create!(
      email: "refresh-race-#{SecureRandom.hex(6)}@example.com",
      clerk_user_id: "refresh_race_#{SecureRandom.hex(8)}",
      subscription_plan: "free"
    )
    client = OauthClient.generate(
      name: "Refresh race client",
      redirect_uris: [ "https://example.com/callback" ]
    ).client
    original = OauthAccessToken.generate_for(
      client: client,
      user: user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    )
    current = original.access_token.refresh!
    grant = original.access_token.oauth_refresh_grant

    ready = Queue.new
    start = Queue.new
    errors = Queue.new
    [ original.access_token.id, current.access_token.id ].map do |token_id|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          token = OauthAccessToken.find(token_id)
          ready << true
          start.pop
          token.refresh!
        rescue StandardError => e
          errors << e
        end
      end
    end.tap do |threads|
      2.times { ready.pop }
      2.times { start << true }
      threads.each(&:join)
    end

    captured_errors = errors.size.times.map { errors.pop }
    assert captured_errors.all? { |error| error.is_a?(OauthError) }, captured_errors.map(&:message).join(", ")
    assert captured_errors.any?
    assert grant.reload.revoked_at.present?
    assert_equal 0, grant.oauth_access_tokens.where(revoked_at: nil).count
  ensure
    client&.destroy!
    user&.destroy!
  end
  test "family revocation serializes against an in-flight refresh" do
    user = User.create!(
      email: "refresh-revoke-#{SecureRandom.hex(6)}@example.com",
      clerk_user_id: "refresh_revoke_#{SecureRandom.hex(8)}",
      subscription_plan: "free"
    )
    client = OauthClient.generate(
      name: "Refresh revoke client",
      redirect_uris: [ "https://example.com/callback" ]
    ).client
    current = OauthAccessToken.generate_for(
      client: client,
      user: user,
      scopes: [ "read" ],
      resource: "https://api.example.com/mcp"
    )
    grant = current.access_token.oauth_refresh_grant

    ready = Queue.new
    start = Queue.new
    errors = Queue.new
    refresh_thread = Thread.new do
      ActiveRecord::Base.connection_pool.with_connection do
        token = OauthAccessToken.find(current.access_token.id)
        ready << true
        start.pop
        token.refresh!
      rescue StandardError => e
        errors << e
      end
    end
    revoke_thread = Thread.new do
      ActiveRecord::Base.connection_pool.with_connection do
        family = OauthRefreshGrant.find(grant.id)
        ready << true
        start.pop
        family.revoke_family!
      rescue StandardError => e
        errors << e
      end
    end

    2.times { ready.pop }
    2.times { start << true }
    [ refresh_thread, revoke_thread ].each(&:join)

    captured_errors = errors.size.times.map { errors.pop }
    assert captured_errors.all? { |error| error.is_a?(OauthError) }, captured_errors.map(&:message).join(", ")
    assert grant.reload.revoked_at.present?
    assert_equal 0, grant.oauth_access_tokens.where(revoked_at: nil).count
  ensure
    client&.destroy!
    user&.destroy!
  end
end
