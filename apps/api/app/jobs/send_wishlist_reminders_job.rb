# Reminds people who joined an exchange but haven't added a single gift idea
# that whoever draws them wants to know what they'd like. Each person gets at
# most two reminders per exchange: the first once they've been in for
# FIRST_AFTER, and a last call in the final LAST_CALL_WINDOW before the
# exchange date, at least GAP after the first. Undated exchanges only get the
# first. Nothing goes out once they add an idea or the exchange date passes.
class SendWishlistRemindersJob < ApplicationJob
  queue_as :default

  KIND = "exchange_wishlist_reminder".freeze
  FIRST_AFTER = 2.days
  GAP = 7.days
  LAST_CALL_WINDOW = 14.days
  # A Secret Santa's own anonymous nudge counts as a reminder for this long.
  MANUAL_NUDGE_QUIET = 3.days

  def perform
    empty_wishlists.find_each do |participant|
      remind(participant)
    rescue StandardError => e
      Rails.logger.error "[SendWishlistRemindersJob] Error for participant #{participant.id}: #{e.message}"
    end
  end

  private

  def empty_wishlists
    ExchangeParticipant
      .accepted
      .where.not(user_id: nil)
      .where.missing(:exchange_wishlist_items)
      .where(created_at: ..FIRST_AFTER.ago)
      .joins(:gift_exchange)
      .where(gift_exchanges: { status: %w[inviting active] })
      .where("gift_exchanges.exchange_date IS NULL OR gift_exchanges.exchange_date >= ?", Date.current)
      .includes(:user, :gift_exchange)
  end

  def remind(participant)
    user = participant.user

    user.with_lock do
      sent = earlier_reminders(participant)
      next unless due?(participant, sent)
      next if recently_nudged?(participant)

      message = ExchangeMailer.wishlist_reminder(participant)
      message.deliver_now
      EmailDelivery.log_sent!(
        user: user,
        kind: KIND,
        subject: message.subject,
        dedupe_key: "participant:#{participant.id}:#{Date.current.iso8601}",
        metadata: { gift_exchange_id: participant.gift_exchange_id, participant_id: participant.id }
      )
      Rails.logger.info "[SendWishlistRemindersJob] Reminded participant #{participant.id} (#{sent.size + 1} of 2)"
    end
  end

  def earlier_reminders(participant)
    EmailDelivery
      .by_user(participant.user)
      .by_kind(KIND)
      .sent
      .where("metadata ->> 'participant_id' = ?", participant.id.to_s)
      .order(:sent_at)
      .to_a
  end

  def due?(participant, sent)
    return true if sent.empty?
    return false if sent.size >= 2

    exchange_date = participant.gift_exchange.exchange_date
    exchange_date.present? &&
      exchange_date <= (Date.current + LAST_CALL_WINDOW) &&
      sent.first.sent_at <= GAP.ago
  end

  def recently_nudged?(participant)
    ExchangeNotification
      .where(recipient_participant: participant, kind: "wishlist_nudge")
      .where(created_at: MANUAL_NUDGE_QUIET.ago..)
      .exists?
  end
end
