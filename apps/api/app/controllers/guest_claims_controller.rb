class GuestClaimsController < ApplicationController
  skip_before_action :authenticate!

  before_action :set_claim

  # GET /claim/:token
  def show
    render json: {
      claim: WishlistItemClaimBlueprint.render_as_hash(@claim, view: :for_guest),
      item: WishlistItemBlueprint.render_as_hash(@claim.wishlist_item, public_view: true),
      wishlist: WishlistBlueprint.render_as_hash(@claim.wishlist, view: :minimal)
    }
  end

  # PATCH /claim/:token
  def update
    # Handle purchased shorthand param
    if params.dig(:claim, :purchased) == true || params.dig(:claim, :purchased) == "true"
      @claim.mark_purchased!
      return render json: WishlistItemClaimBlueprint.render(@claim, view: :for_guest)
    end

    if @claim.update(guest_claim_params)
      render json: WishlistItemClaimBlueprint.render(@claim, view: :for_guest)
    else
      render json: { errors: @claim.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /claim/:token
  def destroy
    @claim.destroy!

    render json: { message: "Claim removed successfully" }
  end

  private

  def set_claim
    @claim = WishlistItemClaim.includes(wishlist_item: :wishlist)
                              .where(user_id: nil) # Security: only guest claims have magic link access
                              .find_by!(claim_token: params[:token])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Claim not found" }, status: :not_found
  end

  def guest_claim_params
    params.require(:claim).permit(:status, :claimer_name, :message)
  end
end
