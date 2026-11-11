class WishlistItemBlueprint < ApplicationBlueprint
  # A claim must look like no claim to the owner, so every field that describes
  # claims starts from this. Public views only carry a current_user for the
  # owner, so guests always get the real numbers.
  def self.visible_claims(item, options)
    item.wishlist.hides_claims_from?(options[:current_user]) ? item.claims.none : item.claims
  end

  def self.visible_claimed_quantity(item, options)
    visible_claims(item, options).sum(:quantity)
  end

  fields :name, :notes, :url, :price_min, :price_max, :priority, :quantity, :position, :image_url, :created_at, :updated_at

  field :wishlist_id do |item|
    item.wishlist_id
  end

  field :is_available do |item, options|
    visible_claimed_quantity(item, options) < item.quantity
  end

  field :available_quantity do |item, options|
    [ item.quantity - visible_claimed_quantity(item, options), 0 ].max
  end

  field :claimed_quantity do |item, options|
    visible_claimed_quantity(item, options)
  end

  field :price_display do |item|
    item.price_display
  end

  field :archived_at do |item|
    item.archived_at
  end

  field :claim_count do |item, options|
    # size works with preloaded associations and counts for queries
    visible_claims(item, options).size
  end

  # Current user's claim on this item (if any)
  field :my_claim do |item, options|
    next nil unless options[:current_user]
    claim = item.claims.find { |c| c.user_id == options[:current_user].id }
    WishlistItemClaimBlueprint.render_as_hash(claim) if claim
  end

  # The public view never says who claimed, only status and quantity.
  field :claims do |item, options|
    if options[:public_view]
      visible_claims(item, options).map { |claim| { status: claim.status, quantity: claim.quantity } }
    else
      WishlistItemClaimBlueprint.render_as_hash(visible_claims(item, options))
    end
  end
end
