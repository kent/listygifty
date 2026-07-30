class AddExchangePublishAndNotifications < ActiveRecord::Migration[8.1]
  def change
    add_column :gift_exchanges, :published_at, :datetime

    create_table :exchange_notifications do |t|
      t.references :gift_exchange, null: false, foreign_key: true
      t.references :recipient_participant,
        null: false,
        foreign_key: { to_table: :exchange_participants }
      t.references :exchange_wishlist_item, null: true, foreign_key: true
      t.string :kind, null: false
      t.datetime :read_at
      t.timestamps
    end

    add_index :exchange_notifications,
      [ :recipient_participant_id, :kind, :created_at ],
      name: "index_exchange_notifications_for_delivery"
  end
end
