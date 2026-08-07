class ValidateAdminMcpOauthForeignKeys < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    validate_foreign_key :oauth_access_tokens, :oauth_refresh_grants
    validate_foreign_key :oauth_access_tokens, :oauth_authorization_codes
    validate_foreign_key :admin_email_drafts, :oauth_access_tokens
    validate_foreign_key :admin_action_confirmations, :oauth_access_tokens
  end

  def down
    # Validation changes no data or constraint semantics and needs no rollback.
  end
end
