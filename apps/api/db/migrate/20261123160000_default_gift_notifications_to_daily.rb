class DefaultGiftNotificationsToDaily < ActiveRecord::Migration[8.1]
  def change
    change_column_default :holiday_users, :gift_notifications, from: "instant", to: "daily"
  end
end
