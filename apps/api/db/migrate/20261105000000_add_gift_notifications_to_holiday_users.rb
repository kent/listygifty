class AddGiftNotificationsToHolidayUsers < ActiveRecord::Migration[8.1]
  def up
    add_column :holiday_users, :gift_notifications, :string, default: "instant", null: false
    add_column :holiday_users, :gifts_notified_at, :datetime
    # Start everyone from now, so the first run doesn't email gifts added
    # before this setting existed.
    execute "UPDATE holiday_users SET gifts_notified_at = NOW()"
  end

  def down
    remove_column :holiday_users, :gifts_notified_at
    remove_column :holiday_users, :gift_notifications
  end
end
