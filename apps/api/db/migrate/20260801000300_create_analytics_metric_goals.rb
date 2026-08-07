class CreateAnalyticsMetricGoals < ActiveRecord::Migration[8.1]
  def change
    create_table :analytics_metric_goals do |t|
      t.string :name, null: false
      t.string :metric_key, null: false
      t.decimal :target_value, precision: 15, scale: 4, null: false
      t.string :comparison_operator, null: false, default: "gte"
      t.date :start_date, null: false
      t.date :target_date, null: false
      t.string :granularity, null: false, default: "week"
      t.jsonb :filters, null: false, default: {}
      t.jsonb :funnel_steps, null: false, default: []
      t.string :status, null: false, default: "active"
      t.text :notes
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end

    add_index :analytics_metric_goals, %i[status target_date]
    add_index :analytics_metric_goals, %i[metric_key status]

    add_index :analytics_events, :occurred_at
    add_index :analytics_events, %i[occurred_at event_name]
    add_index :analytics_events, %i[occurred_at platform]
    add_index :users, :created_at
    add_index :users, %i[subscription_plan created_at]
  end
end
