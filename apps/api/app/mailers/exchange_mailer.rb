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

  def match_assignment(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @exchange_url = "#{@frontend_url}/exchanges/#{@exchange.slug}/my-match"

    mail(
      to: participant.user&.email || participant.email,
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
      to: @participant.user&.email || @participant.email,
      subject: "🎁 Good news: your match added an idea"
    )
  end

  def wishlist_nudge(notification)
    @notification = notification
    @participant = notification.recipient_participant
    @exchange = notification.gift_exchange
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @wishlist_url = "#{@frontend_url}/exchanges/#{@exchange.slug}/my-wishlist"

    mail(
      to: @participant.user&.email || @participant.email,
      subject: "💡 Your Secret Santa needs a little help"
    )
  end
end
