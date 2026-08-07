class GiftsController < ApplicationController
  before_action :set_gift, only: %i[show update destroy reorder]

  def index
    gifts = scoped_gifts
    gifts = gifts.where(holiday_id: params[:holiday_id]) if params[:holiday_id].present?
    render json: GiftBlueprint.render(gifts, current_user: current_user)
  end

  def show
    render_gift(@gift)
  end

  def create
    gift = Gifts::MutationService.new(current_user).create(gift_params)
    render_gift(gift, status: :created)
  rescue Gifts::MutationService::LimitExceeded => e
    render_gift_limit(e.message)
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Holiday, gift status, or person not found" }, status: :not_found
  end

  def update
    Gifts::MutationService.new(current_user).update(@gift, gift_params)
    render_gift(@gift)
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Holiday, gift status, or person not found" }, status: :not_found
  end

  def destroy
    @gift.destroy!
    head :no_content
  end

  def reorder
    new_position = params[:position].to_i
    Gift.reorder_within_holiday(@gift.holiday_id, @gift.id, new_position)

    # Return all gifts for this holiday with updated positions
    gifts = scoped_gifts.where(holiday_id: @gift.holiday_id)
    render json: GiftBlueprint.render(gifts, current_user: current_user)
  end

  private

  def set_gift
    @gift = scoped_gifts.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Gift not found" }, status: :not_found
  end

  def scoped_gifts
    Gift.where(holiday_id: current_user.holiday_ids)
        .includes(
          :gift_status,
          :created_by,
          { holiday: :holiday_users },
          :recipients,
          :givers,
          { gift_recipients: [ :person, :shipping_address ] }
        )
        .by_position
  end

  def render_gift(gift, status: :ok)
    reloaded_gift = scoped_gifts.find(gift.id)
    render json: GiftBlueprint.render(reloaded_gift, current_user: current_user), status: status
  end

  def gift_params
    params.require(:gift).permit(:name, :description, :link, :cost, :holiday_id, :gift_status_id, :position, recipient_ids: [], giver_ids: [])
  end

  def render_gift_limit(message)
    render json: {
      error: "Gift limit reached",
      message: message,
      gifts_remaining: 0,
      upgrade_required: true
    }, status: :payment_required
  end
end
