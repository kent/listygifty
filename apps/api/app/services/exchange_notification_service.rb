class ExchangeNotificationService
  class NudgeError < ArgumentError; end

  NUDGE_COOLDOWN = 24.hours

  def self.wishlist_item_added!(item)
    exchange = item.gift_exchange
    return [] unless %w[active completed].include?(exchange.status)

    exchange.exchange_participants
      .where(matched_participant_id: item.exchange_participant_id)
      .filter_map do |giver|
        next unless giver.user_id.present?

        notification = exchange.exchange_notifications.create!(
          recipient_participant: giver,
          exchange_wishlist_item: item,
          kind: "wishlist_item_added"
        )
        ExchangeMailer.wishlist_updated(notification).deliver_later
        notification
      end
  end

  def self.nudge_match!(giver)
    exchange = giver.gift_exchange
    raise NudgeError, "Matching has not been published" unless %w[active completed].include?(exchange.status)
    raise NudgeError, "You do not have an assigned match" unless giver.matched_participant

    recipient = giver.matched_participant
    recipient.with_lock do
      recent_nudge = exchange.exchange_notifications
        .where(recipient_participant: recipient, kind: "wishlist_nudge")
        .where(created_at: NUDGE_COOLDOWN.ago..)
        .exists?
      raise NudgeError, "Your anonymous request was already sent in the last 24 hours" if recent_nudge

      notification = exchange.exchange_notifications.create!(
        recipient_participant: recipient,
        kind: "wishlist_nudge"
      )
      ExchangeMailer.wishlist_nudge(notification).deliver_later
      notification
    end
  end
end
