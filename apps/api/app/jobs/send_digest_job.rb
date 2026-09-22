class SendDigestJob < ApplicationJob
  queue_as :default

  def perform
    # Find all users who have digest enabled and are collaborators on shared holidays
    users_to_notify.find_each do |user|
      send_digest_to(user)
    end
  end

  private

  def users_to_notify
    User.where(digest_enabled: true)
        .joins(:holiday_users)
        .where(holiday_users: { role: %w[owner collaborator] })
        .distinct
  end

  def send_digest_to(user)
    user.with_lock do
      return unless user.digest_enabled?

      cutoff = Time.current
      # A shared change is pending independently for each collaborator. A global
      # notified_at flag lets the first recipient consume everyone else's email.
      changes = GiftChange.joins(holiday: :holiday_users)
                          .includes(:gift, :holiday, :user)
                          .where(holiday_users: { user_id: user.id, role: %w[owner collaborator] })
                          .where("gift_changes.created_at >= holiday_users.created_at")
                          .where("gift_changes.created_at > ?", user.last_digest_sent_at || user.created_at)
                          .where(gift_changes: { created_at: ..cutoff })
                          .where.not(user_id: user.id)
                          .order("gift_changes.created_at DESC")
                          .to_a
      return if changes.empty?

      DigestMailer.daily_digest(user, changes.group_by(&:holiday)).deliver_now

      GiftChange.mark_notified!(changes.map(&:id))
      # New changes arriving during delivery belong to the next digest.
      user.update_column(:last_digest_sent_at, cutoff)
      Rails.logger.info "[SendDigestJob] Sent digest to #{user.email} with #{changes.length} changes"
    end
  rescue StandardError => e
    Rails.logger.error "[SendDigestJob] Failed to send digest to #{user.email}: #{e.message}"
  end
end
