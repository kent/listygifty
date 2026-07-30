class ExchangeWishlistItemsController < ApplicationController
  before_action :set_participant
  before_action :require_wishlist_viewer, only: %i[index show]
  before_action :require_participant_owner, only: %i[create update destroy]
  before_action :set_wishlist_item, only: %i[show update destroy]

  def index
    items = @participant.exchange_wishlist_items
    render json: ExchangeWishlistItemBlueprint.render(items)
  end

  def show
    render json: ExchangeWishlistItemBlueprint.render(@wishlist_item)
  end

  def create
    item = @participant.exchange_wishlist_items.new(wishlist_item_params)

    if item.save
      ExchangeNotificationService.wishlist_item_added!(item)
      render json: ExchangeWishlistItemBlueprint.render(item), status: :created
    else
      render json: { errors: item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @wishlist_item.update(wishlist_item_params)
      render json: ExchangeWishlistItemBlueprint.render(@wishlist_item)
    else
      render json: { errors: @wishlist_item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @wishlist_item.destroy!
    head :no_content
  end

  private

  def set_participant
    @participant = ExchangeParticipant.includes(:gift_exchange).find(params[:exchange_participant_id])
    if @participant.gift_exchange_id != params[:gift_exchange_id].to_i
      return render json: { error: "Participant not found" }, status: :not_found
    end

    @gift_exchange = GiftExchange.for_user(current_user).find(params[:gift_exchange_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Participant not found" }, status: :not_found
  end

  def require_wishlist_viewer
    return if participant_owner?
    return if current_user_matched_to_participant?

    render json: { error: "Access denied" }, status: :forbidden
  end

  def set_wishlist_item
    @wishlist_item = @participant.exchange_wishlist_items.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Wishlist item not found" }, status: :not_found
  end

  def require_participant_owner
    return if participant_owner?
    render json: { error: "You can only manage your own wishlist" }, status: :forbidden
  end

  def participant_owner?
    @participant.user_id == current_user.id
  end

  def current_user_participant
    @current_user_participant ||= @gift_exchange.exchange_participants.find_by(user_id: current_user.id)
  end

  def current_user_matched_to_participant?
    return false unless %w[active completed].include?(@gift_exchange.status)

    current_user_participant&.matched_participant_id == @participant.id
  end

  def wishlist_item_params
    params.require(:wishlist_item).permit(:name, :description, :link, :price, :photo)
  end
end
