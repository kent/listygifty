class ExchangeNotificationService
  class NudgeError < ArgumentError; end

  NUDGE_COOLDOWN = 24.hours

  # Call once the exchange lock is released. An organizer accepting their own
  # invite gets the confirmation but no notice about themselves.
  def self.invite_accepted!(participant)
    exchange = participant.gift_exchange

    ExchangeMailer.joined_organizer(participant).deliver_later unless exchange.owner?(participant.user)
    ExchangeMailer.join_confirmation(participant).deliver_later
  end

  # One wishlist can back several exchanges, so the giver in each exchange
  # where names are drawn hears about the new idea, once.
  def self.wishlist_item_added!(item)
    owners_places = ExchangeParticipant
      .where(wishlist_id: item.wishlist_id, user_id: item.wishlist.user_id)
      .joins(:gift_exchange)
      .where(gift_exchanges: { status: %w[active completed] })

    ExchangeParticipant
      .where(matched_participant_id: owners_places.select(:id))
      .where.not(user_id: nil)
      .includes(:gift_exchange)
      .order(:id)
      .map do |giver|
        notification = giver.gift_exchange.exchange_notifications.create!(
          recipient_participant: giver,
          wishlist_item: item,
          kind: "wishlist_item_added"
        )
        ExchangeMailer.wishlist_updated(notification).deliver_later
        notification
      end
  end

  def self.nudge_match!(giver)
    exchange = giver.gift_exchange
    raise NudgeError, "Names haven't been drawn yet" unless %w[active completed].include?(exchange.status)
    raise NudgeError, "You do not have an assigned match" unless giver.matched_participant
    raise NudgeError, "Your match no longer has an account" if giver.matched_participant.anonymized?

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
