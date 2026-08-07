class EnableAdminMcpOauth < ActiveRecord::Migration[8.1]
  def change
    create_table :oauth_refresh_grants do |t|
      t.string :family_id, null: false
      t.references :oauth_client, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :resource, null: false
      t.jsonb :scopes, null: false, default: []
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.datetime :last_rotated_at
      t.integer :rotation_count, null: false, default: 0
      t.timestamps
    end

    add_index :oauth_refresh_grants, :family_id, unique: true
    add_index :oauth_refresh_grants, %i[user_id revoked_at]
    add_index :oauth_refresh_grants, :expires_at

    # Legacy application revisions continue writing version 1 during the
    # migration-to-rollout window. The new revision only authenticates v2.
    add_column :oauth_access_tokens, :credential_version, :integer, null: false, default: 1
    add_column :oauth_authorization_codes, :credential_version, :integer, null: false, default: 1

    add_column :oauth_access_tokens, :oauth_refresh_grant_id, :bigint
    add_foreign_key :oauth_access_tokens, :oauth_refresh_grants,
      column: :oauth_refresh_grant_id, on_delete: :nullify, validate: false

    add_column :oauth_access_tokens, :oauth_authorization_code_id, :bigint
    add_foreign_key :oauth_access_tokens, :oauth_authorization_codes,
      column: :oauth_authorization_code_id, on_delete: :nullify, validate: false

    create_table :oauth_authorization_requests do |t|
      t.references :oauth_client, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :request_digest, null: false
      t.string :redirect_uri, null: false
      t.jsonb :scopes, null: false, default: []
      t.string :code_challenge, null: false
      t.string :code_challenge_method, null: false
      t.string :resource, null: false
      t.string :state
      t.datetime :expires_at, null: false
      t.datetime :consumed_at
      t.string :decision
      t.timestamps
    end

    add_index :oauth_authorization_requests, :request_digest, unique: true
    add_index :oauth_authorization_requests, %i[expires_at consumed_at], name: "idx_oauth_authorization_requests_pending"

    add_column :admin_email_drafts, :oauth_access_token_id, :bigint
    add_foreign_key :admin_email_drafts, :oauth_access_tokens,
      column: :oauth_access_token_id, on_delete: :nullify, validate: false

    add_column :admin_action_confirmations, :oauth_access_token_id, :bigint
    add_foreign_key :admin_action_confirmations, :oauth_access_tokens,
      column: :oauth_access_token_id, on_delete: :nullify, validate: false
  end
end
