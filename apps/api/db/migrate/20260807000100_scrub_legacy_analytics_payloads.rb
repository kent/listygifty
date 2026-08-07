class ScrubLegacyAnalyticsPayloads < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL.squish
      UPDATE analytics_events
      SET path = NULL,
          title = NULL,
          referrer = NULL,
          landing_page = NULL,
          properties = '{}'::jsonb,
          updated_at = CURRENT_TIMESTAMP
    SQL

    execute <<~SQL.squish
      UPDATE analytics_visitors
      SET first_landing_page = NULL,
          last_landing_page = NULL,
          first_referrer = NULL,
          last_referrer = NULL,
          updated_at = CURRENT_TIMESTAMP
    SQL
  end

  def down
    # Scrubbed analytics payloads intentionally cannot be reconstructed.
  end
end
