class ExchangeDeletionService
  # Statuses where participants have been invited or matched and deserve a
  # heads-up that the exchange is gone. Draft and completed deletions are
  # silent.
  NOTIFY_STATUSES = %w[inviting active].freeze

  def self.delete!(exchange)
    new(exchange).delete!
  end

  def initialize(exchange)
    @exchange = exchange
  end

  def delete!
    recipients = cancellation_recipients
    exchange_name = @exchange.name
    owner_name = @exchange.user.safe_name

    @exchange.destroy!

    # An account deletion runs this inside a transaction that can still roll
    # back, and nobody should hear about a cancellation that never happened.
    ActiveRecord.after_all_transactions_commit do
      recipients.each do |recipient|
        ExchangeMailer.cancellation(
          email: recipient[:email],
          participant_name: recipient[:name],
          exchange_name: exchange_name,
          owner_name: owner_name
        ).deliver_later
      end
    end
  end

  private

  def cancellation_recipients
    return [] unless NOTIFY_STATUSES.include?(@exchange.status)

    @exchange.exchange_participants
             .where.not(status: "declined")
             .reject { |participant| participant.email == @exchange.user.email }
             .map { |participant| { email: participant.delivery_email, name: participant.display_name } }
             .select { |recipient| recipient[:email].present? }
  end
end
