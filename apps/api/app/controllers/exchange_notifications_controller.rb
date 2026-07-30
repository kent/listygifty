class ExchangeNotificationsController < ApplicationController
  before_action :set_exchange_and_participant
  before_action :set_notification, only: :read

  def index
    notifications = @gift_exchange.exchange_notifications
      .where(recipient_participant: @participant)
      .recent_first
    render json: ExchangeNotificationBlueprint.render(notifications)
  end

  def read
    render json: ExchangeNotificationBlueprint.render(@notification.mark_read!)
  end

  private

  def set_exchange_and_participant
    @gift_exchange = GiftExchange.for_user(current_user).find(params[:gift_exchange_id])
    @participant = @gift_exchange.participant_for(current_user)
    raise ActiveRecord::RecordNotFound unless @participant
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Gift exchange not found" }, status: :not_found
  end

  def set_notification
    @notification = @gift_exchange.exchange_notifications
      .where(recipient_participant: @participant)
      .find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Notification not found" }, status: :not_found
  end
end
