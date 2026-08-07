class AddAnalyticsReportingIndexes < ActiveRecord::Migration[8.1]
  def change
    add_index :analytics_events, %i[anonymous_id occurred_at]
    add_index :analytics_visitors, %i[user_id first_seen_at]
    add_index :marketing_spends, %i[source spend_date]
    add_index :marketing_spends, %i[campaign spend_date]
  end
end
