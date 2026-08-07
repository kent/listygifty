class CreateAdminMcpRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :admin_audit_events do |t|
      t.references :actor, null: false, foreign_key: { to_table: :users }
      t.string :action, null: false
      t.string :resource_type
      t.bigint :resource_id
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end

    add_index :admin_audit_events, :action
    add_index :admin_audit_events, %i[resource_type resource_id]
    add_index :admin_audit_events, %i[actor_id created_at]

    create_table :admin_email_drafts do |t|
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.references :recipient, null: false, foreign_key: { to_table: :users }
      t.string :recipient_email, null: false
      t.string :subject, null: false
      t.text :body, null: false
      t.string :confirmation_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :queued_at
      t.timestamps
    end

    add_index :admin_email_drafts, :confirmation_digest, unique: true
    add_index :admin_email_drafts, %i[expires_at queued_at]

    create_table :admin_action_confirmations do |t|
      t.references :actor, null: false, foreign_key: { to_table: :users }
      t.string :action, null: false
      t.string :target_type, null: false
      t.bigint :target_id, null: false
      t.string :target_label, null: false
      t.jsonb :payload, null: false, default: {}
      t.string :confirmation_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :consumed_at
      t.timestamps
    end

    add_index :admin_action_confirmations, :confirmation_digest, unique: true
    add_index :admin_action_confirmations, %i[target_type target_id]
    add_index :admin_action_confirmations, %i[expires_at consumed_at]
  end
end
