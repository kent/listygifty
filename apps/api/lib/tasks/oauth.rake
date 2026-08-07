namespace :oauth do
  desc "Revoke all OAuth credentials before rolling back to a pre-v2 application revision"
  task revoke_all_for_legacy_rollback: :environment do
    unless ENV["OAUTH_ROLLBACK_QUIESCED"] == "true"
      abort "Refusing rollback revocation: quiesce OAuth issuance and set OAUTH_ROLLBACK_QUIESCED=true"
    end

    now = Time.current
    counts = ActiveRecord::Base.transaction do
      revoked_grants = OauthRefreshGrant.where(revoked_at: nil)
        .update_all(revoked_at: now, updated_at: now)
      revoked_tokens = OauthAccessToken.where(revoked_at: nil)
        .update_all(revoked_at: now, updated_at: now)
      deleted_codes = OauthAuthorizationCode.delete_all
      deleted_requests = OauthAuthorizationRequest.delete_all
      [ revoked_grants, revoked_tokens, deleted_codes, deleted_requests ]
    end

    active_credentials = OauthRefreshGrant.where(revoked_at: nil).count +
      OauthAccessToken.where(revoked_at: nil).count +
      OauthAuthorizationCode.count + OauthAuthorizationRequest.count
    abort "OAuth credentials appeared during rollback revocation" unless active_credentials.zero?

    puts "Revoked OAuth grants=#{counts[0]} tokens=#{counts[1]}; " \
      "deleted codes=#{counts[2]} requests=#{counts[3]}"
  end
end
