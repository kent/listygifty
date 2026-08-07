class OauthCredentialCleanupJob < ApplicationJob
  queue_as :background

  ORPHANED_DYNAMIC_CLIENT_RETENTION = 24.hours
  RETIRED_CLIENT_DRAIN = 15.minutes
  REVOKED_FAMILY_RETENTION = 1.hour

  def perform
    now = Time.current
    revoked_counts = delete_revoked_families(now)
    counts = {
      authorization_requests: delete_in_batches(OauthAuthorizationRequest.where(expires_at: ..now)),
      authorization_codes: delete_in_batches(OauthAuthorizationCode.where(expires_at: ..now)),
      access_tokens: delete_in_batches(expired_access_tokens(now)) + revoked_counts[:access_tokens],
      refresh_grants: delete_in_batches(OauthRefreshGrant.where(expires_at: ..now)) + revoked_counts[:refresh_grants],
      dynamic_clients_retired: retire_orphaned_dynamic_clients(now),
      dynamic_clients_deleted: delete_retired_dynamic_clients(now)
    }
    Rails.logger.info("OAuth credential cleanup #{counts.map { |key, value| "#{key}=#{value}" }.join(" ")}")
  end

  private

  def expired_access_tokens(now)
    OauthAccessToken.where(<<~SQL.squish, now: now)
      expires_at <= :now AND
      (refresh_token_expires_at IS NULL OR refresh_token_expires_at <= :now)
    SQL
  end

  def delete_revoked_families(now)
    counts = { access_tokens: 0, refresh_grants: 0 }
    OauthRefreshGrant.where(revoked_at: ..REVOKED_FAMILY_RETENTION.ago(now)).in_batches(of: 500) do |grants|
      grant_ids = grants.pluck(:id)
      counts[:access_tokens] += OauthAccessToken.where(oauth_refresh_grant_id: grant_ids).delete_all
      counts[:refresh_grants] += OauthRefreshGrant.where(id: grant_ids)
        .where.not(revoked_at: nil)
        .where.not(id: OauthAccessToken.select(:oauth_refresh_grant_id))
        .delete_all
    end
    counts
  end

  def orphaned_dynamic_clients(now)
    OauthClient.where(is_dynamic: true, created_at: ...ORPHANED_DYNAMIC_CLIENT_RETENTION.ago(now))
      .where.not(id: OauthAccessToken.select(:oauth_client_id))
      .where.not(id: OauthRefreshGrant.select(:oauth_client_id))
  end

  # Successful code exchange first advances updated_at with a conditional
  # non-key UPDATE. PostgreSQL rechecks this predicate after a concurrent row
  # update, so either issuance advances the marker and retirement skips it, or
  # retirement revokes it and issuance fails closed.
  def retire_orphaned_dynamic_clients(now)
    orphaned_dynamic_clients(now)
      .where(revoked_at: nil, updated_at: ...ORPHANED_DYNAMIC_CLIENT_RETENTION.ago(now))
      .update_all(revoked_at: now, updated_at: now)
  end

  # Requests and codes have drained before deletion. Delete children first and
  # re-check durable credentials immediately before removing each parent batch.
  def delete_retired_dynamic_clients(now)
    deleted = 0
    orphaned_dynamic_clients(now)
      .where(revoked_at: ..RETIRED_CLIENT_DRAIN.ago(now))
      .in_batches(of: 500) do |clients|
        candidate_ids = clients.pluck(:id)
        OauthAuthorizationRequest.where(oauth_client_id: candidate_ids).delete_all
        OauthAuthorizationCode.where(oauth_client_id: candidate_ids).delete_all
        deletable_ids = orphaned_dynamic_clients(now).where(id: candidate_ids).pluck(:id)
        deleted += OauthClient.where(id: deletable_ids).delete_all
      end
    deleted
  end

  def delete_in_batches(relation)
    relation.in_batches(of: 500).delete_all
  end
end
