class AddAdminMcpOauthIndexes < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  INDEXES = [
    [ :oauth_clients, :created_at, { where: "is_dynamic = TRUE", name: "idx_oauth_clients_dynamic_created_at" } ],
    [ :oauth_access_tokens, :credential_version, {} ],
    [ :oauth_authorization_codes, :credential_version, {} ],
    [ :oauth_access_tokens, :oauth_refresh_grant_id, {} ],
    [ :oauth_access_tokens, :oauth_authorization_code_id, { unique: true } ],
    [ :admin_email_drafts, :oauth_access_token_id, {} ],
    [ :admin_action_confirmations, :oauth_access_token_id, {} ]
  ].freeze

  def up
    INDEXES.each do |table, columns, options|
      ensure_index(table, columns, options)
    end
  end

  def down
    INDEXES.reverse_each do |table, columns, options|
      remove_options = concurrent_options.merge(if_exists: true)
      remove_options[:name] = options[:name] if options[:name]
      remove_index table, columns, **remove_options
    end
  end

  private

  def ensure_index(table, columns, options)
    name = options[:name] || connection.index_name(table, column: columns)
    if connection.adapter_name == "PostgreSQL"
      validity = connection.select_value(<<~SQL.squish)
        SELECT indisvalid
        FROM pg_index
        WHERE indexrelid = to_regclass(#{connection.quote(name)})
      SQL
      return if validity == true || validity == "t"

      remove_index table, name: name, algorithm: :concurrently, if_exists: true if validity == false || validity == "f"
    elsif index_exists?(table, columns, **options.slice(:name, :unique))
      return
    end

    add_index table, columns, **options, **concurrent_options
  end

  def concurrent_options
    connection.adapter_name == "PostgreSQL" ? { algorithm: :concurrently } : {}
  end
end
