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

  # A run of edits sends one "updated" notice. Another goes out once the
  # giver reads it, or after this long.
  CHANGE_QUIET_PERIOD = 24.hours

  # One wishlist can back several exchanges, so the giver in each exchange
  # where names are drawn hears about the new idea, once.
  def self.wishlist_item_added!(item)
    givers_of(item.wishlist).map do |giver|
      notification = giver.gift_exchange.exchange_notifications.create!(
        recipient_participant: giver,
        wishlist_item: item,
        kind: "wishlist_item_added"
      )
      ExchangeMailer.wishlist_updated(notification).deliver_later
      notification
    end
  end

  # An item was edited or removed. The notice never names the item: a removed
  # one is gone, and either way the giver should look at the whole list.
  def self.wishlist_changed!(wishlist)
    givers_of(wishlist).filter_map { |giver| notify_change!(giver) }
  end

  # The person pointed this exchange at a different one of their wishlists.
  # Only this exchange's giver sees a different list.
  def self.exchange_wishlist_switched!(participant)
    return [] unless drawn?(participant.gift_exchange)

    participant.matched_by_participants.where.not(user_id: nil).includes(:gift_exchange).order(:id)
      .filter_map { |giver| notify_change!(giver) }
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

  # Whoever drew a person this wishlist belongs to, in each exchange where
  # names are drawn. Never the owner, and never someone without an account.
  def self.givers_of(wishlist)
    owners_places = ExchangeParticipant
      .where(wishlist_id: wishlist.id, user_id: wishlist.user_id)
      .joins(:gift_exchange)
      .where(gift_exchanges: { status: %w[active completed] })

    ExchangeParticipant
      .where(matched_participant_id: owners_places.select(:id))
      .where.not(user_id: nil)
      .includes(:gift_exchange)
      .order(:id)
  end
  private_class_method :givers_of

  def self.drawn?(exchange)
    %w[active completed].include?(exchange.status)
  end
  private_class_method :drawn?

  # Skips a giver who already has an unread notice about this list from the
  # quiet period, so an evening of edits is one email, not twenty.
  def self.notify_change!(giver)
    exchange = giver.gift_exchange
    giver.with_lock do
      waiting = exchange.exchange_notifications.unread
        .where(recipient_participant: giver, kind: %w[wishlist_item_added wishlist_changed])
        .where(created_at: CHANGE_QUIET_PERIOD.ago..)
        .exists?
      next if waiting

      notification = exchange.exchange_notifications.create!(recipient_participant: giver, kind: "wishlist_changed")
      ExchangeMailer.wishlist_changed(notification).deliver_later
      notification
    end
  end
  private_class_method :notify_change!
end
