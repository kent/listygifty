class ExtendOauthRefreshGrantLifetime < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL
      UPDATE oauth_refresh_grants
      SET expires_at = created_at + INTERVAL '1 year',
          updated_at = CURRENT_TIMESTAMP
      WHERE revoked_at IS NULL
        AND expires_at < created_at + INTERVAL '1 year'
    SQL

    execute <<~SQL
      UPDATE oauth_access_tokens AS token
      SET refresh_token_expires_at = refresh_grant.expires_at,
          updated_at = CURRENT_TIMESTAMP
      FROM oauth_refresh_grants AS refresh_grant
      WHERE token.oauth_refresh_grant_id = refresh_grant.id
        AND token.refresh_token_hash IS NOT NULL
        AND token.refresh_token_expires_at IS DISTINCT FROM refresh_grant.expires_at
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
