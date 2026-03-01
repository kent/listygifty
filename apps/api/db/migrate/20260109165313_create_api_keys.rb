class CreateApiKeys < ActiveRecord::Migration[8.1]
  def change
    create_table :api_keys do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :key_prefix, null: false
      t.string :key_hash, null: false
      t.string :scopes, array: true, default: []
      t.datetime :last_used_at
      t.datetime :expires_at
      t.datetime :revoked_at
      t.timestamps

      t.index :key_prefix, unique: true
      t.index [ :user_id, :revoked_at ]
    end
  end
end
