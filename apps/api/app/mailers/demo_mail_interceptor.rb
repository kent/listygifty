# Anyone can sign in to the demo account, so it never receives email. This
# drops its address from every message and skips messages left with no one.
class DemoMailInterceptor
  FIELDS = %i[to cc bcc].freeze

  def self.delivering_email(message)
    FIELDS.each do |field|
      addresses = Array(message.public_send(field))
      kept = addresses.reject { |address| DemoAccount.email?(address) }
      message.public_send("#{field}=", kept.presence) if kept.length != addresses.length
    end
    message.perform_deliveries = false if FIELDS.all? { |field| Array(message.public_send(field)).empty? }
  end
end
