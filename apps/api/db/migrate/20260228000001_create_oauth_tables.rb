class CreateOauthTables < ActiveRecord::Migration[8.1]
  def change
    # OAuth Clients - stores registered OAuth clients (including Claude)
    create_table :oauth_clients do |t|
      t.string :client_id, null: false
      t.string :client_secret_hash # nil for public clients
      t.string :name, null: false
      t.text :description
      t.string :logo_uri
      t.string :client_uri
      t.jsonb :redirect_uris, default: [], null: false
      t.jsonb :grant_types, default: [ "authorization_code" ], null: false
      t.jsonb :response_types, default: [ "code" ], null: false
      t.string :token_endpoint_auth_method, default: "none" # none, client_secret_basic, client_secret_post
      t.jsonb :scopes, default: [ "read", "write" ], null: false
      t.boolean :is_system, default: false, null: false # true for pre-registered clients like Claude
      t.boolean :is_dynamic, default: false, null: false # true for dynamically registered clients
      t.references :user, foreign_key: true # owner for user-registered clients
      t.datetime :revoked_at
      t.timestamps
    end

    add_index :oauth_clients, :client_id, unique: true
    add_index :oauth_clients, :is_system

    # OAuth Authorization Codes - short-lived codes exchanged for tokens
    create_table :oauth_authorization_codes do |t|
      t.references :oauth_client, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :code_hash, null: false
      t.string :redirect_uri, null: false
      t.jsonb :scopes, default: [], null: false
      t.string :code_challenge # PKCE
      t.string :code_challenge_method # S256 or plain
      t.string :resource # RFC 8707 - the MCP server URI
      t.string :state # Optional state parameter
      t.datetime :expires_at, null: false
      t.datetime :used_at
      t.timestamps
    end

    add_index :oauth_authorization_codes, :code_hash, unique: true
    add_index :oauth_authorization_codes, :expires_at

    # OAuth Access Tokens - bearer tokens for API access
    create_table :oauth_access_tokens do |t|
      t.references :oauth_client, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :token_hash, null: false
      t.string :refresh_token_hash
      t.jsonb :scopes, default: [], null: false
      t.string :resource # RFC 8707 - the MCP server this token is for
      t.datetime :expires_at, null: false
      t.datetime :refresh_token_expires_at
      t.datetime :revoked_at
      t.datetime :last_used_at
      t.string :user_agent
      t.string :ip_address
      t.timestamps
    end

    add_index :oauth_access_tokens, :token_hash, unique: true
    add_index :oauth_access_tokens, :refresh_token_hash, unique: true, where: "refresh_token_hash IS NOT NULL"
    add_index :oauth_access_tokens, :expires_at
    add_index :oauth_access_tokens, [ :user_id, :revoked_at ], name: "idx_oauth_tokens_user_active"
  end
end
