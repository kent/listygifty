# Emails each member of a shared gift list when someone else adds a gift,
# for members whose setting for that list is "instant". Runs every few
# minutes and waits for a burst of adds to settle, so adding five gifts in a
# row sends one email, not five. Edits to existing gifts stay in the daily
# digest.
class SendGiftAddedEmailsJob < ApplicationJob
  queue_as :default

  KIND = "gift_added".freeze
  # Wait this long after the latest add before emailing...
  QUIET_FOR = 5.minutes
  # ...unless the earliest unsent add has already waited this long.
  MAX_WAIT = 30.minutes

  def perform
    memberships_with_new_gifts.find_each do |membership|
      notify(membership)
    rescue StandardError => e
      Rails.logger.error "[SendGiftAddedEmailsJob] Error for holiday_user #{membership.id}: #{e.message}"
    end
  end

  private

  def memberships_with_new_gifts
    HolidayUser
      .where(gift_notifications: "instant")
      .joins(:holiday)
      .where(holidays: { archived: false })
      .where(<<~SQL.squish)
        EXISTS (
          SELECT 1 FROM gift_changes
          WHERE gift_changes.holiday_id = holiday_users.holiday_id
            AND gift_changes.change_type = 'created'
            AND gift_changes.user_id <> holiday_users.user_id
            AND gift_changes.created_at > COALESCE(holiday_users.gifts_notified_at, holiday_users.created_at)
        )
      SQL
      .includes(:user, :holiday)
  end

  def notify(membership)
    membership.with_lock do
      next unless membership.gift_notifications == "instant"

      changes = new_gifts_for(membership)
      next if changes.empty?
      next if changes.last.created_at > QUIET_FOR.ago && changes.first.created_at > MAX_WAIT.ago

      message = GiftListMailer.gifts_added(membership.user, membership.holiday, changes)
      message.deliver_now
      # The newest add sent, not the clock, so an add landing mid-send is next time's.
      membership.update_column(:gifts_notified_at, changes.last.created_at)
      EmailDelivery.log_sent!(
        user: membership.user,
        holiday: membership.holiday,
        kind: KIND,
        subject: message.subject,
        dedupe_key: "holiday:#{membership.holiday_id}:#{changes.last.id}",
        metadata: { gift_change_ids: changes.map(&:id) }
      )
      Rails.logger.info "[SendGiftAddedEmailsJob] Emailed user #{membership.user_id} about #{changes.size} gifts in holiday #{membership.holiday_id}"
    end
  end

  def new_gifts_for(membership)
    GiftChange
      .created
      .where(holiday_id: membership.holiday_id)
      .where.not(user_id: membership.user_id)
      .where("gift_changes.created_at > ?", membership.gifts_notified_at || membership.created_at)
      .includes(:user, gift: :recipients)
      .order(:created_at, :id)
      .to_a
  end
end
