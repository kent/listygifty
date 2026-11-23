class SendDigestJob < ApplicationJob
  queue_as :default

  def perform
    now = Time.current.in_time_zone("America/Toronto")
    cutoff = now.change(hour: 21, min: 0)
    cutoff -= 1.day if cutoff > now

    users_to_notify.find_each do |user|
      send_digest_to(user, cutoff)
    end
  end

  private

  def users_to_notify
    User.where(digest_enabled: true)
        .joins(:holiday_users)
        .where(holiday_users: { role: %w[owner collaborator], gift_notifications: %w[instant daily] })
        .distinct
  end

  def send_digest_to(user, cutoff)
    user.with_lock do
      return unless user.digest_enabled?

      shared_list_ids = HolidayUser.where.not(user_id: user.id).select(:holiday_id)
      changes = GiftChange.created.joins(holiday: :holiday_users)
                          .preload(:holiday, :user, gift: [ :recipients, :givers, :gift_status ])
                          .where(holidays: { archived: false })
                          .where(holiday_users: { user_id: user.id, role: %w[owner collaborator], gift_notifications: %w[instant daily] })
                          .where("gift_changes.created_at >= holiday_users.created_at")
                          # Earlier instant emails recorded the newest addition they covered for each member.
                          .where("holiday_users.gifts_notified_at IS NULL OR gift_changes.created_at > holiday_users.gifts_notified_at")
                          .where("gift_changes.created_at > ?", user.last_digest_sent_at || user.created_at)
                          .where(gift_changes: { holiday_id: shared_list_ids, created_at: ..cutoff })
                          .order(created_at: :desc, id: :desc)
                          .to_a
      return if changes.empty?

      DigestMailer.daily_digest(user, changes.group_by(&:holiday), date: cutoff.to_date).deliver_now

      GiftChange.mark_notified!(changes.map(&:id))
      # Use the scheduled boundary so a rerun cannot start a second digest for this evening.
      user.update_column(:last_digest_sent_at, cutoff)
      Rails.logger.info "[SendDigestJob] Sent digest to #{user.email} with #{changes.length} new gifts"
    end
  rescue StandardError => e
    Rails.logger.error "[SendDigestJob] Failed to send digest to #{user.email}: #{e.message}"
  end
end
