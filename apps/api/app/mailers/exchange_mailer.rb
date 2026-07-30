class ExchangeMailer < ApplicationMailer
  def invitation(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @owner = @exchange.user
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @invite_url = "#{@frontend_url}/join/exchange/#{participant.invite_token}"

    mail(
      to: participant.email,
      subject: "🎁 You're invited to #{@exchange.name}!"
    )
  end

  def match_assignment(participant)
    @participant = participant
    @exchange = participant.gift_exchange
    @match = participant.matched_participant
    @frontend_url = ENV.fetch("FRONTEND_URL", "https://listygifty.com")
    @exchange_url = "#{@frontend_url}/exchanges/#{@exchange.slug}/my-match"

    mail(
      to: participant.user&.email || participant.email,
      subject: "🎅 Your Secret Santa match for #{@exchange.name}!"
    )
  end
end
