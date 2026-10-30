class WishlistsController < ApplicationController
  include WorkspaceScoped

  before_action :set_wishlist, only: %i[show update destroy share revoke_share reveal_claims]
  before_action :require_owner, only: %i[update destroy share revoke_share reveal_claims]

  def index
    wishlists = Wishlist.visible_to(current_user, current_workspace)
                        .includes(:user, :wishlist_items)
                        .order(created_at: :desc)
    render json: WishlistBlueprint.render(wishlists, current_user: current_user)
  end

  def show
    render json: WishlistBlueprint.render(@wishlist, view: :with_items, current_user: current_user)
  end

  def create
    wishlist = current_workspace.wishlists.build(wishlist_params)
    wishlist.user = current_user

    if wishlist.save
      render json: WishlistBlueprint.render(wishlist, current_user: current_user), status: :created
    else
      render json: { errors: wishlist.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @wishlist.update(wishlist_params)
      render json: WishlistBlueprint.render(@wishlist, current_user: current_user)
    else
      render json: { errors: @wishlist.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @wishlist.destroy!
    head :no_content
  end

  # POST /wishlists/:id/share
  def share
    @wishlist.ensure_share_link!

    render json: {
      share_token: @wishlist.share_token,
      share_url: wishlist_share_url(@wishlist.share_token),
      visibility: @wishlist.visibility
    }
  end

  # DELETE /wishlists/:id/revoke_share
  def revoke_share
    @wishlist.revoke_share_link!

    render json: {
      message: "Share link revoked",
      visibility: @wishlist.visibility
    }
  end

  # POST /wishlists/:id/reveal_claims
  def reveal_claims
    revealed_count = @wishlist.claims.unrevealed.update_all(revealed_at: Time.current)

    render json: {
      message: "#{revealed_count} claims revealed",
      revealed_count: revealed_count
    }
  end

  private

  def set_wishlist
    @wishlist = Wishlist.visible_to(current_user, current_workspace)
                        .includes(:user, wishlist_items: :claims)
                        .find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Wishlist not found" }, status: :not_found
  end

  def require_owner
    return if @wishlist.owner?(current_user)
    render json: { error: "Only the wishlist owner can perform this action" }, status: :forbidden
  end

  def wishlist_params
    params.require(:wishlist).permit(:name, :description, :visibility, :anti_spoiler_enabled, :target_date)
  end

  def wishlist_share_url(token)
    "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}/w/#{token}"
  end
end
