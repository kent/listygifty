class ExchangeExclusionsController < ApplicationController
  before_action :set_gift_exchange
  before_action :require_owner
  before_action :set_exclusion, only: %i[destroy]
  before_action :require_editable, only: %i[create destroy]

  def index
    exclusions = @gift_exchange.exchange_exclusions.includes(:participant_a, :participant_b)
    render json: ExchangeExclusionBlueprint.render(exclusions)
  end

  def create
    exclusion = @gift_exchange.exchange_exclusions.new(exclusion_params)

    if exclusion.save
      render json: ExchangeExclusionBlueprint.render(exclusion), status: :created
    else
      render json: { errors: exclusion.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @exclusion.destroy!
    head :no_content
  end

  private

  def set_gift_exchange
    @gift_exchange = GiftExchange.owned_by(current_user).find(params[:gift_exchange_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Gift exchange not found" }, status: :not_found
  end

  def set_exclusion
    @exclusion = @gift_exchange.exchange_exclusions.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Exclusion not found" }, status: :not_found
  end

  def require_owner
    return if @gift_exchange.owner?(current_user)
    render json: { error: "Only the owner can manage exclusions" }, status: :forbidden
  end

  def require_editable
    return if @gift_exchange.editable?

    render_error("Published exchanges cannot be changed", status: :unprocessable_entity)
  end

  def exclusion_params
    params.require(:exchange_exclusion).permit(:participant_a_id, :participant_b_id)
  end
end
