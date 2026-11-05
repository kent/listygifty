class ExchangeMailer < ApplicationMailer
  def invitation(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @owner = @exchange.user
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @invite_url = "#{@frontend_url}/join/exchange/#{participant.invite_token}"

    mail(
      to: participant.email,
      subject: "🎁 #{@owner.safe_name} wants you in: #{@exchange.name}"
    )
  end

  def joined_organizer(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @owner = @exchange.user
    @exchange_url = exchange_url(@exchange)

    mail(
      to: @owner.email,
      subject: "🎁 #{@participant.display_name} joined #{@exchange.name}"
    )
  end

  # The organizer's list of people who joined but have not added a single
  # wishlist idea, so they know who to chase before (or after) names are drawn.
  def organizer_wishlist_reminder(exchange, waiting_participants)
    @exchange = exchange
    @owner = exchange.user
    @waiting = waiting_participants
    @exchange_url = exchange_url(exchange)
    @subject = self.class.organizer_wishlist_reminder_subject(exchange, waiting_participants.size)

    mail(to: @owner.email, subject: @subject)
  end

  def self.organizer_wishlist_reminder_subject(exchange, count)
    people = count == 1 ? "1 person still needs" : "#{count} people still need"
    "🎁 #{people} to add gift ideas: #{exchange.name}"
  end

  def join_confirmation(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @owner = @exchange.user
    @exchange_url = exchange_url(@exchange)

    mail(
      to: @participant.delivery_email,
      subject: "🎁 You're in: #{@exchange.name}"
    )
  end

  def match_assignment(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @exchange_url = "#{@frontend_url}/exchanges/#{@exchange.slug}/my-match"

    mail(
      to: participant.delivery_email,
      subject: "🎁 The names are in: #{@exchange.name}"
    )
  end

  def wishlist_updated(notification)
    @notification = notification
    @participant = notification.recipient_participant
    @exchange = notification.gift_exchange
    @match = @participant.matched_participant
    @item = notification.exchange_wishlist_item
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @exchange_url = "#{@frontend_url}/exchanges/#{@exchange.slug}/my-match"

    mail(
      to: @participant.delivery_email,
      subject: "🎁 Good news: your match added an idea"
    )
  end

  # Plain string args only: by the time this delivers, the exchange and its
  # participants have already been destroyed.
  def cancellation(email:, participant_name:, exchange_name:, owner_name:)
    @participant_name = participant_name
    @exchange_name = exchange_name
    @owner_name = owner_name

    mail(
      to: email,
      subject: "🎁 Cancelled: #{exchange_name}"
    )
  end

  def wishlist_nudge(notification)
    @notification = notification
    @participant = notification.recipient_participant
    @exchange = notification.gift_exchange
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @wishlist_url = "#{@frontend_url}/exchanges/#{@exchange.slug}/my-wishlist"

    mail(
      to: @participant.delivery_email,
      subject: "💡 Your Secret Santa needs a little help"
    )
  end

  private

  def exchange_url(exchange)
    "#{ENV.fetch("FRONTEND_URL", "https://listygifty.com")}/exchanges/#{exchange.slug}"
  end
end
