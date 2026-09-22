class PublicWishlistsController < ApplicationController
  skip_before_action :authenticate!

  before_action :set_wishlist
  before_action :set_item, only: [ :claim ]

  # GET /w/:token
  def show
    render json: WishlistBlueprint.render(@wishlist, view: :public)
  end

  # POST /w/:token/items/:item_id/claim
  def claim
    guest_name = claim_params[:claimer_name]
    guest_email = claim_params[:claimer_email].to_s.strip.downcase

    # Validate guest identity
    if guest_name.blank? || guest_email.blank?
      return render json: { error: "Name and email are required" }, status: :unprocessable_entity
    end

    # Check if this email already claimed this item
    existing_claim = @item.claims.by_guest_email(guest_email).first
    if existing_claim
      return render json: { error: "This email has already claimed this item" }, status: :unprocessable_entity
    end

    new_claim = Wishlists::ClaimService.create!(
      item: @item, claimer_name: guest_name, claimer_email: guest_email,
      quantity: claim_params.fetch(:quantity, 1), purchased: claim_params[:purchased]
    )

    # Send confirmation email with magic link
    GuestClaimMailer.claim_confirmation(new_claim).deliver_later

    render json: {
      message: "Item claimed! Check your email for a link to manage your claim.",
      claim_id: new_claim.id
    }, status: :created
  rescue ArgumentError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  private

  def set_wishlist
    @wishlist = Wishlist.includes(wishlist_items: :claims)
                        .find_by!(share_token: params[:token], visibility: "shared")
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Wishlist not found or not shared" }, status: :not_found
  end

  def set_item
    @item = @wishlist.wishlist_items.active.find(params[:item_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Item not found" }, status: :not_found
  end

  def claim_params
    params.require(:claim).permit(:claimer_name, :claimer_email, :quantity, :purchased)
  end
end
