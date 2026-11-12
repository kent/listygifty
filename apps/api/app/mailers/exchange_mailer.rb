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

  # The organizer's nudge for someone who hasn't answered their invite.
  # Sent by ExchangeNudgeService.
  def invite_nudge(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @owner = @exchange.user
    @invite_url = "#{ENV.fetch("FRONTEND_URL", "https://listygifty.com")}/join/exchange/#{participant.invite_token}"

    mail(
      to: participant.email,
      subject: "👋 #{@owner.safe_name} is still saving you a spot in #{@exchange.name}"
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

  # Who the organizer invited that hasn't accepted yet, so they can chase them
  # before drawing names.
  def organizer_pending_joins(exchange, pending_participants)
    @exchange = exchange
    @pending = pending_participants
    @joined_count = exchange.exchange_participants.accepted.count
    @exchange_url = exchange_url(exchange)
    people = @pending.size == 1 ? "1 person still needs" : "#{@pending.size} people still need"

    mail(to: exchange.user.email, subject: "🎁 #{people} to join: #{exchange.name}")
  end

  # Nobody the organizer invited is left to accept, so it's time to draw names.
  def organizer_ready_to_draw(exchange, joined_participants)
    @exchange = exchange
    @joined = joined_participants
    @exchange_url = exchange_url(exchange)

    mail(to: exchange.user.email, subject: "🎁 Everyone's in. Time to draw names: #{exchange.name}")
  end

  # For someone who joined but hasn't added a single idea. Sent by
  # SendWishlistRemindersJob, at most twice per exchange.
  def wishlist_reminder(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @drawn = @exchange.status == "active"
    @wishlist_url = "#{ENV.fetch("FRONTEND_URL", "https://listygifty.com")}/exchanges/#{@exchange.slug}/my-wishlist"

    mail(
      to: participant.delivery_email,
      subject: "💡 What would you like? Add gift ideas for #{@exchange.name}"
    )
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
    @item = notification.wishlist_item
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

  # To the person asked. The exchange page is where they say yes or no.
  def wishlist_access_requested(notification)
    @participant = notification.recipient_participant
    @requester = notification.wishlist_access_request.requester_participant
    @exchange = notification.gift_exchange
    @exchange_url = exchange_url(@exchange)

    mail(
      to: @participant.delivery_email,
      subject: "👀 #{@requester.display_name} wants to see your wishlist"
    )
  end

  def wishlist_access_approved(notification)
    access_request = notification.wishlist_access_request
    @participant = notification.recipient_participant
    @requested = access_request.requested_participant
    @exchange = notification.gift_exchange
    @wishlist_url = "#{exchange_url(@exchange)}/participants/#{@requested.id}"

    mail(
      to: @participant.delivery_email,
      subject: "🎁 #{@requested.display_name} shared their wishlist with you"
    )
  end

  def wishlist_access_denied(notification)
    @participant = notification.recipient_participant
    @requested = notification.wishlist_access_request.requested_participant
    @exchange = notification.gift_exchange
    @exchange_url = exchange_url(@exchange)

    mail(
      to: @participant.delivery_email,
      subject: "#{@requested.display_name} is keeping their wishlist private"
    )
  end

  private

  def exchange_url(exchange)
    "#{ENV.fetch("FRONTEND_URL", "https://listygifty.com")}/exchanges/#{exchange.slug}"
  end
end
