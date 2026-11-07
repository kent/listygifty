# An organizer's reminder to someone they invited who hasn't joined yet. It
# emails the invite link again and, when the organizer has the person's
# mobile number and has confirmed the person said it's OK to text them,
# texts it too.
#
# Each person can be nudged once a day, and an organizer can send at most
# DAILY_LIMIT nudges a day across their exchanges, so a nudge never turns
# into spam.
class ExchangeNudgeService
  COOLDOWN = 24.hours
  DAILY_LIMIT = 30

  class Error < StandardError; end

  # text is :sent, :failed or :skipped (no number, no consent, or texting is
  # off).
  Result = Data.define(:participant, :text, :text_error)

  # email and phone, when given, update the person's details first, so the
  # organizer can fix a typo or add a number in the same step. text_consent
  # true records that the person said it's OK to text them, false withdraws
  # it, and nil leaves it as it was.
  def self.nudge!(participant, email: nil, phone: nil, text_consent: nil)
    new(participant).nudge!(email: email, phone: phone, text_consent: text_consent)
  end

  def initialize(participant)
    @participant = participant
    @exchange = participant.gift_exchange
  end

  def nudge!(email:, phone:, text_consent:)
    @exchange.with_lock do
      @participant.reload
      check_nudgeable!

      @participant.email = email unless email.nil?
      @participant.phone = phone unless phone.nil?
      @participant.text_consent_at = (text_consent ? Time.current : nil) unless text_consent.nil?
      @participant.last_nudged_at = Time.current
      @participant.save!

      ExchangeMailer.invite_nudge(@participant).deliver_later
    end

    # Outside the lock, so a slow Twilio never holds up the exchange.
    text, text_error = send_text
    Result.new(participant: @participant, text: text, text_error: text_error)
  end

  def self.text_body(participant)
    exchange = participant.gift_exchange
    invite_url = "#{ENV.fetch("FRONTEND_URL", "https://listygifty.com")}/join/exchange/#{participant.invite_token}"

    "Listy Gifty: #{exchange.user.safe_name} saved you a spot in #{exchange.name}. " \
      "Join before names are drawn: #{invite_url}\n\nReply STOP to opt out."
  end

  private

  def check_nudgeable!
    name = @participant.display_name
    raise Error, "Names have already been drawn for #{@exchange.name}." unless @exchange.editable?
    raise Error, "#{name} has already joined." if @participant.status == "accepted"
    raise Error, "#{name} said no. Invite them again instead." unless @participant.status == "invited"
    raise Error, "You already nudged #{name} today. You can nudge them again tomorrow." if @participant.nudged_recently?
    raise Error, "You've sent #{DAILY_LIMIT} nudges today. You can send more tomorrow." if daily_limit_reached?
  end

  def daily_limit_reached?
    ExchangeParticipant
      .joins(:gift_exchange)
      .where(gift_exchanges: { user_id: @exchange.user_id })
      .where(last_nudged_at: COOLDOWN.ago..)
      .count >= DAILY_LIMIT
  end

  def send_text
    return [ :skipped, nil ] unless @participant.textable? && TextMessenger.configured?

    TextMessenger.deliver(to: @participant.phone, body: self.class.text_body(@participant))
    [ :sent, nil ]
  rescue TextMessenger::Rejected => e
    [ :failed, e.message ]
  rescue TextMessenger::Error => e
    Rails.logger.error("[ExchangeNudgeService] Text to participant #{@participant.id} failed: #{e.message}")
    [ :failed, "The text didn't go through. Try again later." ]
  end
end
