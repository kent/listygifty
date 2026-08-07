class CreateStripeWebhookEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :stripe_webhook_events do |t|
      t.string :stripe_event_id, null: false
      t.string :stripe_checkout_session_id, null: false
      t.string :event_type, null: false
      t.timestamps
    end

    add_index :stripe_webhook_events, :stripe_event_id, unique: true
    add_index :stripe_webhook_events, :stripe_checkout_session_id, unique: true
  end
end
