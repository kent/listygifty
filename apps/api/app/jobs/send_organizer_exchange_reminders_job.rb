# Nudges each organizer whose exchange is still waiting on its draw. While
# anyone they invited hasn't accepted, the organizer gets the list of who to
# chase. Once nobody is left to accept, they get a reminder to draw names so
# everyone gets their match. Each email goes out at most once every
# CADENCE_DAYS per exchange, and both stop once names are drawn or the
# exchange date passes.
class SendOrganizerExchangeRemindersJob < ApplicationJob
  queue_as :default

  PENDING_KIND = "organizer_pending_joins".freeze
  READY_KIND = "organizer_ready_to_draw".freeze
  CADENCE_DAYS = 3

  def perform
    undrawn_exchanges.find_each do |exchange|
      remind_organizer(exchange)
    rescue StandardError => e
      Rails.logger.error "[SendOrganizerExchangeRemindersJob] Error for exchange #{exchange.id}: #{e.message}"
    end
  end

  private

  # Drawing names moves an exchange out of "inviting", which ends both reminders.
  def undrawn_exchanges
    GiftExchange
      .includes(:user)
      .where(status: "inviting")
      .where("exchange_date IS NULL OR exchange_date >= ?", Date.current)
  end

  def remind_organizer(exchange)
    participants = exchange.exchange_participants.includes(:user).order(:name)
    pending = participants.invited.reject { |participant| participant.user_id == exchange.user_id }

    if pending.any?
      deliver(exchange, PENDING_KIND, pending) { ExchangeMailer.organizer_pending_joins(exchange, pending) }
    elsif exchange.can_publish?
      joined = participants.accepted.to_a
      deliver(exchange, READY_KIND, joined) { ExchangeMailer.organizer_ready_to_draw(exchange, joined) }
    end
  end

  def deliver(exchange, kind, participants)
    organizer = exchange.user

    organizer.with_lock do
      next if sent_recently?(organizer, exchange, kind)

      message = yield
      message.deliver_now
      EmailDelivery.log_sent!(
        user: organizer,
        kind: kind,
        subject: message.subject,
        dedupe_key: "exchange:#{exchange.id}:#{Date.current.iso8601}",
        metadata: { gift_exchange_id: exchange.id, participant_ids: participants.map(&:id) }
      )
      Rails.logger.info "[SendOrganizerExchangeRemindersJob] Sent #{kind} for exchange #{exchange.id}"
    end
  end

  # Counted per kind, so the reminder to draw names goes out as soon as the
  # last person joins instead of waiting behind a recent "still waiting" email.
  # Counted in calendar days, so a daily run lands on every third day rather
  # than drifting a day late when one run starts a few seconds earlier.
  def sent_recently?(organizer, exchange, kind)
    EmailDelivery
      .by_user(organizer)
      .by_kind(kind)
      .sent
      .since((Date.current - (CADENCE_DAYS - 1)).beginning_of_day)
      .where("metadata ->> 'gift_exchange_id' = ?", exchange.id.to_s)
      .exists?
  end
end
