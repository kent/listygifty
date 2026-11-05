# Tells each organizer who has joined their exchange but still has an empty
# wishlist. Runs daily and emails a given exchange at most once per CADENCE_DAYS,
# so the reminder stops on its own once everyone has added an idea, the
# exchange date passes, or the exchange is completed.
class SendOrganizerWishlistRemindersJob < ApplicationJob
  queue_as :default

  KIND = "organizer_wishlist_reminder".freeze
  CADENCE_DAYS = 3
  OPEN_STATUSES = %w[inviting active].freeze

  def perform
    open_exchanges.find_each do |exchange|
      remind_organizer(exchange)
    rescue StandardError => e
      Rails.logger.error "[SendOrganizerWishlistRemindersJob] Error for exchange #{exchange.id}: #{e.message}"
    end
  end

  private

  def open_exchanges
    GiftExchange
      .includes(:user)
      .where(status: OPEN_STATUSES)
      .where("exchange_date IS NULL OR exchange_date >= ?", Date.current)
  end

  def remind_organizer(exchange)
    organizer = exchange.user

    organizer.with_lock do
      return if sent_recently?(organizer, exchange)

      waiting = waiting_participants(exchange)
      return if waiting.empty?

      subject = ExchangeMailer.organizer_wishlist_reminder_subject(exchange, waiting.size)
      dedupe_key = "exchange:#{exchange.id}:#{Date.current.iso8601}"

      ExchangeMailer.organizer_wishlist_reminder(exchange, waiting).deliver_now
      EmailDelivery.log_sent!(
        user: organizer,
        kind: KIND,
        subject: subject,
        dedupe_key: dedupe_key,
        metadata: { gift_exchange_id: exchange.id, participant_ids: waiting.map(&:id) }
      )
      Rails.logger.info "[SendOrganizerWishlistRemindersJob] Reminded organizer of exchange #{exchange.id} about #{waiting.size} people"
    end
  end

  # Accepted people with no wishlist ideas. The organizer's own row is left
  # out: the email is about who they need to chase, not about them.
  def waiting_participants(exchange)
    exchange.exchange_participants
      .accepted
      .where.missing(:exchange_wishlist_items)
      .includes(:user)
      .order(:name)
      .reject { |participant| participant.user_id == exchange.user_id }
  end

  # Counted in calendar days, so a daily run lands on every third day rather
  # than drifting a day late when one run starts a few seconds earlier.
  def sent_recently?(organizer, exchange)
    EmailDelivery
      .by_user(organizer)
      .by_kind(KIND)
      .sent
      .since((Date.current - (CADENCE_DAYS - 1)).beginning_of_day)
      .where("metadata ->> 'gift_exchange_id' = ?", exchange.id.to_s)
      .exists?
  end
end
