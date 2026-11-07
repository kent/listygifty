require "net/http"

# Sends text messages through Twilio's Messages API. It signs in with a
# restricted API key (TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET) that can
# only send and read messages on TWILIO_ACCOUNT_SID.
#
# Texts to US numbers come from TWILIO_US_FROM_NUMBER, a toll-free number
# that carriers have verified. US carriers block texts from unverified
# numbers, so until that's set, US numbers aren't texted at all. Everything
# else comes from TWILIO_FROM_NUMBER, a Canadian number.
#
# In tests, messages collect in TextMessenger.deliveries instead, the way
# ActionMailer's test deliveries do.
class TextMessenger
  class Error < StandardError; end

  # Texting isn't set up in this environment.
  class NotConfigured < Error; end

  # Couldn't reach Twilio, or Twilio had trouble on its end. Worth a retry.
  class Unavailable < Error; end

  # Twilio turned this message down and trying again won't help, for example
  # because the number is wrong or its owner replied STOP.
  class Rejected < Error
    attr_reader :code

    def initialize(message, code: nil)
      super(message)
      @code = code
    end
  end

  API_HOST = "api.twilio.com".freeze
  ENV_KEYS = %w[TWILIO_ACCOUNT_SID TWILIO_API_KEY_SID TWILIO_API_KEY_SECRET TWILIO_FROM_NUMBER].freeze

  # What the organizer is told when Twilio refuses a text, by Twilio error code.
  REJECTION_MESSAGES = {
    21211 => "That phone number doesn't look right.",
    21408 => "Listy Gifty can't text numbers in that country yet.",
    21610 => "That number replied STOP to Listy Gifty texts, so we can't text it.",
    21612 => "That number can't get texts from Listy Gifty.",
    21614 => "That number can't get texts. It may be a landline."
  }.freeze
  DEFAULT_REJECTION = "The text didn't go through.".freeze
  US_UNAVAILABLE = "Listy Gifty can't text US numbers yet.".freeze

  NETWORK_ERRORS = [
    Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED,
    Errno::ECONNRESET, Errno::EHOSTUNREACH, OpenSSL::SSL::SSLError, EOFError
  ].freeze

  cattr_accessor :delivery_method, default: :twilio
  cattr_accessor :deliveries, default: []

  def self.configured?
    delivery_method == :test || ENV_KEYS.all? { |key| ENV[key].present? }
  end

  # Returns Twilio's message SID.
  def self.deliver(to:, body:)
    raise Rejected.new(US_UNAVAILABLE, code: :us_unavailable) if PhoneNumber.us?(to) && !us_texting?

    if delivery_method == :test
      deliveries << { to: to, body: body }
      return "SM#{SecureRandom.hex(16)}"
    end
    raise NotConfigured, "Texting isn't set up" unless configured?

    response = post_message(to: to, from: sender_for(to), body: body)
    payload = JSON.parse(response.body) rescue {}
    return payload.fetch("sid") if response.is_a?(Net::HTTPSuccess)

    if response.code.to_i == 429 || response.code.to_i >= 500
      raise Unavailable, "Twilio answered #{response.code}"
    end

    code = payload["code"]
    Rails.logger.warn("[TextMessenger] Twilio refused a text: #{code} #{payload["message"]}")
    raise Rejected.new(REJECTION_MESSAGES.fetch(code, DEFAULT_REJECTION), code: code)
  rescue *NETWORK_ERRORS => e
    raise Unavailable, "Couldn't reach Twilio: #{e.class}"
  end

  def self.us_texting?
    ENV["TWILIO_US_FROM_NUMBER"].present?
  end

  def self.sender_for(to)
    PhoneNumber.us?(to) ? ENV.fetch("TWILIO_US_FROM_NUMBER") : ENV.fetch("TWILIO_FROM_NUMBER")
  end

  def self.post_message(to:, from:, body:)
    uri = URI::HTTPS.build(host: API_HOST, path: "/2010-04-01/Accounts/#{ENV.fetch("TWILIO_ACCOUNT_SID")}/Messages.json")
    request = Net::HTTP::Post.new(uri)
    request.basic_auth(ENV.fetch("TWILIO_API_KEY_SID"), ENV.fetch("TWILIO_API_KEY_SECRET"))
    request.set_form_data("To" => to, "From" => from, "Body" => body)

    Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) do |http|
      http.request(request)
    end
  end
  private_class_method :post_message
end
