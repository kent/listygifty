# frozen_string_literal: true

class GiftRecipientsController < ApplicationController
  before_action :set_gift
  before_action :set_gift_recipient
  before_action :authorize_address_management!

  def update
    if @gift_recipient.update(gift_recipient_params)
      render json: GiftBlueprint.render(@gift, current_user: current_user)
    else
      render json: { errors: @gift_recipient.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_gift
    @gift = Gift.joins(:holiday).where(holidays: { id: current_user.holiday_ids }).find(params[:gift_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Gift not found" }, status: :not_found
  end

  def set_gift_recipient
    @gift_recipient = @gift.gift_recipients.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Recipient not found" }, status: :not_found
  end

  def authorize_address_management!
    return if @gift.holiday.workspace.admin?(current_user)

    render json: { error: "Only workspace admins can manage shipping addresses" }, status: :forbidden
  end

  def gift_recipient_params
    params.require(:gift_recipient).permit(:shipping_address_id)
  end
end
