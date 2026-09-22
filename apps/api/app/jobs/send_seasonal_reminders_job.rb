class SendSeasonalRemindersJob < ApplicationJob
  queue_as :default

  # Cadence: days between reminder emails
  PENDING_GIFTS_CADENCE = 3
  NO_GIFTS_CHRISTMAS_CADENCE = 3
  NO_LISTS_DECEMBER_CADENCE = 7

  def perform
    return unless december?

    User.find_each do |user|
      user.with_lock do
        send_pending_gifts_reminder(user)
        send_no_gifts_before_christmas_reminder(user)
        send_no_gift_lists_december_reminder(user)
      end
    rescue StandardError => e
      Rails.logger.error "[SendSeasonalRemindersJob] Error for #{user.email}: #{e.message}"
    end
  end

  private

  def december?
    Date.current.month == 12
  end

  def before_christmas?
    Date.current.month == 12 && Date.current.day < 25
  end

  # 1) Pending gifts reminder: gifts not done/wrapped
  def send_pending_gifts_reminder(user)
    prefs = user.notification_preference
    return unless prefs&.pending_gifts_reminder_enabled != false

    # Check cadence
    return if sent_recently?(user, :pending_gifts, PENDING_GIFTS_CADENCE)

    pending_by_holiday = pending_gifts_by_holiday(user)
    return if pending_by_holiday.empty?

    dedupe_key = dedupe_key_for_period(:pending_gifts, PENDING_GIFTS_CADENCE)
    subject = build_pending_gifts_subject(pending_by_holiday)

    send_and_log(user, :pending_gifts, subject, dedupe_key) do
      RemindersMailer.pending_gifts(user, pending_by_holiday).deliver_now
    end
  end

  # 2) No gifts before Christmas: user has Christmas holiday but no gifts
  def send_no_gifts_before_christmas_reminder(user)
    return unless before_christmas?

    prefs = user.notification_preference
    return unless prefs&.no_gifts_before_christmas_enabled != false

    # Check cadence
    return if sent_recently?(user, :no_gifts_before_christmas, NO_GIFTS_CHRISTMAS_CADENCE)

    christmas_holiday = find_christmas_holiday(user)
    return unless christmas_holiday
    return if christmas_holiday.gifts.any?

    dedupe_key = dedupe_key_for_period(:no_gifts_before_christmas, NO_GIFTS_CHRISTMAS_CADENCE)
    reminder_date = christmas_holiday.date || Date.new(Date.current.year, 12, 25)
    days_until = (reminder_date - Date.current).to_i
    subject = "🎄 #{days_until} days until Christmas - start your gift list!"

    send_and_log(user, :no_gifts_before_christmas, subject, dedupe_key, holiday: christmas_holiday) do
      RemindersMailer.no_gifts_before_christmas(user, christmas_holiday).deliver_now
    end
  end

  # 3) No gift lists in December: user has no active holidays
  def send_no_gift_lists_december_reminder(user)
    return unless december?

    prefs = user.notification_preference
    return unless prefs&.no_gift_lists_december_enabled != false

    # Check cadence (weekly)
    return if sent_recently?(user, :no_gift_lists_december, NO_LISTS_DECEMBER_CADENCE)

    # User has no active non-template holidays
    active_holidays = user.holidays.where(is_template: false, archived: false, completed: false)
    return if active_holidays.any?

    dedupe_key = dedupe_key_for_period(:no_gift_lists_december, NO_LISTS_DECEMBER_CADENCE)
    subject = "🎁 December is here! Time to start planning gifts"

    send_and_log(user, :no_gift_lists_december, subject, dedupe_key) do
      RemindersMailer.no_gift_lists_december(user).deliver_now
    end
  end

  # Find user's Christmas holiday (date Dec 25 OR name contains 'christmas')
  def find_christmas_holiday(user)
    this_year = Date.current.year
    christmas_date = Date.new(this_year, 12, 25)

    user.holidays
        .where(is_template: false, archived: false, completed: false)
        .where("date = ? OR LOWER(name) LIKE ?", christmas_date, "%christmas%")
        .where("date IS NULL OR date BETWEEN ? AND ?", Date.current, Date.current.end_of_year)
        .first
  end

  # Get pending (not done/wrapped) gifts grouped by holiday
  def pending_gifts_by_holiday(user)
    done_status_ids = GiftStatus.completed_ids

    user.holidays
        .where(is_template: false, archived: false, completed: false)
        .includes(gifts: [ :gift_status, :recipients ])
        .each_with_object({}) do |holiday, result|
      pending = holiday.gifts.reject { |g| done_status_ids.include?(g.gift_status_id) }
      result[holiday] = pending if pending.any?
    end
  end

  def build_pending_gifts_subject(pending_by_holiday)
    total = pending_by_holiday.values.flatten.count
    "🎁 #{total} gift#{'s' if total != 1} still need#{'s' if total == 1} attention!"
  end

  def sent_recently?(user, kind, days)
    EmailDelivery.sent_within?(user: user, kind: kind.to_s, days: days)
  end

  # Generate a dedupe key based on date period (e.g., "2025-12-12:3" for 3-day cadence)
  def dedupe_key_for_period(kind, cadence_days)
    period_start = (Date.current.yday / cadence_days) * cadence_days
    "#{Date.current.year}:#{period_start}:#{cadence_days}"
  end

  def send_and_log(user, kind, subject, dedupe_key, holiday: nil)
    yield
    EmailDelivery.log_sent!(
      user: user,
      kind: kind.to_s,
      subject: subject,
      dedupe_key: dedupe_key,
      holiday: holiday,
      metadata: { sent_by: "SendSeasonalRemindersJob" }
    )
    Rails.logger.info "[SendSeasonalRemindersJob] Sent #{kind} to #{user.email}"
  rescue ActiveRecord::RecordNotUnique
    # Dedupe constraint violation - already sent in this period
    Rails.logger.info "[SendSeasonalRemindersJob] Skipping #{kind} for #{user.email} - dedupe"
  rescue StandardError => e
    EmailDelivery.log_failed!(
      user: user,
      kind: kind.to_s,
      subject: subject,
      dedupe_key: "failed:#{SecureRandom.uuid}",
      error: e.message,
      holiday: holiday,
      metadata: { sent_by: "SendSeasonalRemindersJob" }
    )
    Rails.logger.error "[SendSeasonalRemindersJob] Failed #{kind} for #{user.email}: #{e.message}"
  end
end
