class ExchangeWishlistItemsController < ApplicationController
  before_action :set_participant
  before_action :require_wishlist_viewer, only: %i[index show]
  before_action :require_participant_owner, only: %i[create update destroy reorder]
  before_action :require_marker, only: %i[claim mark_purchased unclaim]
  before_action :set_wishlist_item, only: %i[show update destroy claim mark_purchased unclaim]
  before_action :set_my_claim, only: %i[mark_purchased unclaim]

  def index
    render json: render_items(@participant.wishlist_items.with_attached_photo.includes(:claims, :wishlist))
  end


  def show
    render json: render_items(@wishlist_item)
  end

  def create
    attributes = wishlist_item_params
    upload = attributes.delete(:photo)
    item = @participant.wishlist!.wishlist_items.new(attributes)

    if save_with_upload(item, upload)
      ExchangeNotificationService.wishlist_item_added!(item)
      render json: render_items(item), status: :created
    else
      render json: { errors: item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    attributes = wishlist_item_params
    upload = attributes.delete(:photo)
    @wishlist_item.assign_attributes(attributes)
    if save_with_upload(@wishlist_item, upload)
      ExchangeNotificationService.wishlist_changed!(@wishlist_item.wishlist) if upload || @wishlist_item.saved_change_for_giver?
      render json: render_items(@wishlist_item)
    else
      render json: { errors: @wishlist_item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @wishlist_item.destroy!
    ExchangeNotificationService.wishlist_changed!(@wishlist_item.wishlist)
    head :no_content
  end

  # PATCH .../exchange_wishlist_items/reorder with { item_ids: [3, 1, 2] }
  def reorder
    @participant.wishlist!.reorder!(item_ids: Array(params[:item_ids]))
    render json: render_items(@participant.wishlist_items.reload)
  rescue ArgumentError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST .../exchange_wishlist_items/:id/claim with optional { purchased: true }
  # Someone who can see the list marks what they're getting. Everyone else who
  # can see it finds the item taken. The list's owner never does.
  def claim
    if @wishlist_item.claims.by_user(current_user).exists?
      return render json: { error: "You have already marked this item" }, status: :unprocessable_entity
    end

    Wishlists::ClaimService.create!(
      item: @wishlist_item, user: current_user, exchange_participant: current_user_participant,
      purchased: params[:purchased]
    )
    render json: render_items(@wishlist_item.reload), status: :created
  rescue ArgumentError
    render json: { error: "Someone is already getting this one.", code: "already_claimed" }, status: :conflict
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  def mark_purchased
    @my_claim.mark_purchased!
    render json: render_items(@wishlist_item.reload)
  end

  def unclaim
    @my_claim.destroy!
    render json: render_items(@wishlist_item.reload)
  end

  private

  def render_items(items)
    ExchangeWishlistItemBlueprint.render(items, participant_id: @participant.id, viewer: current_user)
  end

  def require_marker
    return if !participant_owner? && current_user_participant&.can_see_wishlist_of?(@participant)

    render json: { error: "You can only mark items on a list you can see" }, status: :forbidden
  end

  def set_my_claim
    @my_claim = @wishlist_item.claims.by_user(current_user).first
    render json: { error: "You have not marked this item" }, status: :not_found unless @my_claim
  end

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
    return if current_user_participant&.can_see_wishlist_of?(@participant)

    render json: { error: "Access denied" }, status: :forbidden
  end

  def set_wishlist_item
    @wishlist_item = @participant.wishlist_items.find(params[:id])
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

  def save_with_upload(item, upload)
    return item.save unless upload

    unless upload.is_a?(ActionDispatch::Http::UploadedFile)
      item.errors.add(:photo, "must be uploaded as multipart file data")
      return false
    end

    photo = Photos::Processor.call(upload.read, basename: File.basename(upload.original_filename.to_s, ".*"))
    current_user.with_lock do
      Photos.assign(item, photo, user: current_user)
      item.save
    end
  rescue Photos::Invalid => e
    item.errors.add(:base, e.message)
    false
  end

  # The exchange screens send description, link and one price. Wishlist items
  # store notes, url and a price range, so one price fills both ends.
  def wishlist_item_params
    permitted = params.require(:wishlist_item).permit(:name, :description, :link, :price, :photo)
    attributes = permitted.slice(:name, :photo).to_h
    attributes[:notes] = permitted[:description] if permitted.key?(:description)
    attributes[:url] = permitted[:link] if permitted.key?(:link)
    if permitted.key?(:price)
      attributes[:price_min] = attributes[:price_max] = permitted[:price].presence
    end
    attributes
  end
end
