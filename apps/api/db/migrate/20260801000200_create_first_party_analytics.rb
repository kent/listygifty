class CreateFirstPartyAnalytics < ActiveRecord::Migration[8.1]
  def change
    create_table :analytics_visitors do |t|
      t.string :anonymous_id, null: false
      t.references :user, foreign_key: true
      t.datetime :first_seen_at, null: false
      t.datetime :last_seen_at, null: false
      t.string :first_landing_page
      t.string :last_landing_page
      t.string :first_referrer
      t.string :last_referrer
      t.string :first_channel, null: false, default: "direct"
      t.string :last_channel, null: false, default: "direct"
      t.jsonb :first_touch, null: false, default: {}
      t.jsonb :last_touch, null: false, default: {}
      t.timestamps
    end

    add_index :analytics_visitors, :anonymous_id, unique: true
    add_index :analytics_visitors, :first_seen_at
    add_index :analytics_visitors, :last_seen_at
    add_index :analytics_visitors, :first_channel

    create_table :analytics_events do |t|
      t.string :event_id, null: false
      t.string :event_name, null: false
      t.datetime :occurred_at, null: false
      t.datetime :received_at, null: false
      t.references :analytics_visitor, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.references :workspace, foreign_key: true
      t.string :anonymous_id, null: false
      t.string :session_id, null: false
      t.string :platform, null: false, default: "unknown"
      t.string :path
      t.string :title
      t.string :referrer
      t.string :landing_page
      t.string :channel, null: false, default: "direct"
      t.string :utm_source
      t.string :utm_medium
      t.string :utm_campaign
      t.string :utm_term
      t.string :utm_content
      t.jsonb :click_ids, null: false, default: {}
      t.jsonb :properties, null: false, default: {}
      t.string :ip_hash
      t.string :user_agent
      t.timestamps
    end

    add_index :analytics_events, :event_id, unique: true
    add_index :analytics_events, %i[event_name occurred_at]
    add_index :analytics_events, %i[analytics_visitor_id occurred_at]
    add_index :analytics_events, %i[user_id occurred_at]
    add_index :analytics_events, %i[session_id occurred_at]
    add_index :analytics_events, %i[channel occurred_at]
    add_index :analytics_events, %i[utm_source occurred_at]
    add_index :analytics_events, %i[utm_campaign occurred_at]

    create_table :marketing_spends do |t|
      t.date :spend_date, null: false
      t.string :channel, null: false
      t.string :source, null: false
      t.string :medium, null: false, default: ""
      t.string :campaign, null: false, default: ""
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.string :currency, null: false, default: "USD"
      t.integer :impressions
      t.integer :clicks
      t.text :notes
      t.timestamps
    end

    add_index :marketing_spends,
      %i[spend_date source medium campaign],
      unique: true,
      name: "idx_marketing_spends_identity"
    add_index :marketing_spends, %i[channel spend_date]
  end
end
