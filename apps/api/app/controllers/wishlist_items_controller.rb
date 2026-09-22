class WishlistItemsController < ApplicationController
  include WorkspaceScoped

  before_action :set_wishlist
  before_action :set_item, only: %i[show update destroy claim unclaim mark_purchased]
  before_action :require_owner, only: %i[create update destroy reorder]

  def index
    items = @wishlist.wishlist_items.active.by_priority.includes(:claims)
    render json: WishlistItemBlueprint.render(items, current_user: current_user)
  end

  def show
    render json: WishlistItemBlueprint.render(@item, current_user: current_user)
  end

  def create
    item = @wishlist.wishlist_items.build(item_params)

    if item.save
      render json: WishlistItemBlueprint.render(item, current_user: current_user), status: :created
    else
      render json: { errors: item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @item.update(item_params)
      render json: WishlistItemBlueprint.render(@item, current_user: current_user)
    else
      render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @item.destroy!
    head :no_content
  end

  # PATCH /wishlists/:wishlist_id/wishlist_items/reorder
  def reorder
    positions = params[:positions] # { item_id: position }
    unless positions.is_a?(ActionController::Parameters) && positions.keys.all? { |id| id.match?(/\A[1-9]\d*\z/) }
      return render json: { error: "Positions must map item IDs to non-negative integers" }, status: :unprocessable_entity
    end

    WishlistItem.transaction do
      positions.each_pair.sort_by { |item_id, _| item_id.to_i }.each do |item_id, position|
        @wishlist.wishlist_items.find(item_id).update!(position: position)
      end
    end

    items = @wishlist.wishlist_items.active.by_position
    render json: WishlistItemBlueprint.render(items, current_user: current_user)
  rescue ActiveRecord::RecordNotFound => e
    render json: { error: "Item not found: #{e.message}" }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # POST /wishlists/:wishlist_id/wishlist_items/:id/claim
  def claim
    # Owners cannot claim their own items
    if @wishlist.owner?(current_user)
      return render json: { error: "You cannot claim items from your own wishlist" }, status: :forbidden
    end

    # Check if user already claimed this item
    existing_claim = @item.claims.by_user(current_user).first
    if existing_claim
      return render json: { error: "You have already claimed this item" }, status: :unprocessable_entity
    end

    claim = Wishlists::ClaimService.create!(
      item: @item, user: current_user,
      quantity: params.fetch(:quantity, 1), purchased: params[:purchased]
    )

    render json: WishlistItemClaimBlueprint.render(claim), status: :created
  rescue ArgumentError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # DELETE /wishlists/:wishlist_id/wishlist_items/:id/unclaim
  def unclaim
    claim = @item.claims.by_user(current_user).first

    unless claim
      return render json: { error: "You have not claimed this item" }, status: :not_found
    end

    claim.destroy!
    head :no_content
  end

  # PATCH /wishlists/:wishlist_id/wishlist_items/:id/mark_purchased
  def mark_purchased
    claim = @item.claims.by_user(current_user).first

    unless claim
      return render json: { error: "You have not claimed this item" }, status: :not_found
    end

    claim.mark_purchased!
    render json: WishlistItemClaimBlueprint.render(claim)
  end

  private

  def set_wishlist
    @wishlist = Wishlist.visible_to(current_user, current_workspace)
                        .includes(:user)
                        .find(params[:wishlist_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Wishlist not found" }, status: :not_found
  end

  def set_item
    @item = @wishlist.wishlist_items.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Item not found" }, status: :not_found
  end

  def require_owner
    return if @wishlist.owner?(current_user)
    render json: { error: "Only the wishlist owner can perform this action" }, status: :forbidden
  end

  def item_params
    params.require(:wishlist_item).permit(:name, :notes, :url, :price_min, :price_max, :priority, :quantity, :image_url)
  end
end
