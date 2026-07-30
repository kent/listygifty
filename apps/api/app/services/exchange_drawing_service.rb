class ExchangeDrawingService
  class RedoError < StandardError; end

  def initialize(exchange)
    @exchange = exchange
  end

  def publish!
    ExchangeMatchingService.new(@exchange).perform!
    deliver_assignments
    @exchange.reload
  end

  def reopen!
    @exchange.with_lock do
      require_published!

      participants = @exchange.exchange_participants
      participants.update_all(matched_participant_id: nil, updated_at: Time.current)
      participants.where.not(user_id: nil).update_all(status: "accepted", updated_at: Time.current)
      participants.where(user_id: nil).update_all(status: "invited", updated_at: Time.current)
      @exchange.exchange_notifications.delete_all
      @exchange.update!(status: "inviting", published_at: nil)
    end

    @exchange.reload
  end

  def redraw!
    GiftExchange.transaction do
      require_published!
      ExchangeMatchingService.new(@exchange).perform!(redraw: true)
      @exchange.exchange_notifications.delete_all
    end

    deliver_assignments
    @exchange.reload
  end

  private

  def require_published!
    return if %w[active completed].include?(@exchange.status)

    raise RedoError, "Only a published exchange can be redone"
  end

  def deliver_assignments
    @exchange.exchange_participants.accepted.includes(:user).each do |participant|
      ExchangeMailer.match_assignment(participant).deliver_later
    end
  end
end
