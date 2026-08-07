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
    attributes = wishlist_item_params
    item = @participant.exchange_wishlist_items.new(attributes)

    if persist_with_photo_quota(item, attributes[:photo]) { item.save }
      ExchangeNotificationService.wishlist_item_added!(item)
      render json: ExchangeWishlistItemBlueprint.render(item), status: :created
    else
      render json: { errors: item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    attributes = wishlist_item_params
    if persist_with_photo_quota(@wishlist_item, attributes[:photo]) { @wishlist_item.update(attributes) }
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

  def persist_with_photo_quota(item, uploaded_photo)
    return yield unless uploaded_photo

    unless uploaded_photo.is_a?(ActionDispatch::Http::UploadedFile)
      item.errors.add(:photo, "must be uploaded as multipart file data")
      return false
    end

    current_user.with_lock do
      existing_bytes = item.persisted? && item.photo.attached? ? item.photo.blob.byte_size : 0
      requested_bytes = uploaded_photo.size
      projected_bytes = photo_storage_bytes_for_current_user - existing_bytes + requested_bytes
      if projected_bytes > ExchangeWishlistItem::MAX_PHOTO_STORAGE_PER_USER_BYTES
        item.errors.add(:photo, "storage limit of 50 MB has been reached")
        false
      else
        yield
      end
    end
  end

  def photo_storage_bytes_for_current_user
    item_ids = ExchangeWishlistItem.joins(:exchange_participant)
      .where(exchange_participants: { user_id: current_user.id })
      .select(:id)
    ActiveStorage::Attachment.joins(:blob)
      .where(record_type: "ExchangeWishlistItem", record_id: item_ids, name: "photo")
      .sum("active_storage_blobs.byte_size")
  end

  def wishlist_item_params
    params.require(:wishlist_item).permit(:name, :description, :link, :price, :photo)
  end
end
