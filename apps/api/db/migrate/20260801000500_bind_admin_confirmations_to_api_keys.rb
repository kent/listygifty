class BindAdminConfirmationsToApiKeys < ActiveRecord::Migration[8.1]
  def change
    add_reference :admin_email_drafts, :api_key, foreign_key: { on_delete: :nullify }
    add_reference :admin_action_confirmations, :api_key, foreign_key: { on_delete: :nullify }
  end
end
