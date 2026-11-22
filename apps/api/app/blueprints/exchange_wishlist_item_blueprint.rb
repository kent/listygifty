# An item on a person's wishlist, in the shape the exchange screens and older
# iOS builds already read. Pass `participant_id:` so each item says which
# exchange place it was read through, and `viewer:` (a user) so someone who
# can see the list also sees what's taken. Without a viewer, or for the list's
# owner, every item reads as untouched: the owner must never learn what
# someone got them.
class ExchangeWishlistItemBlueprint < ApplicationBlueprint
  def self.claims_shown(item, options)
    viewer = options[:viewer]
    viewer.nil? || item.wishlist.hides_claims_from?(viewer) ? [] : item.claims.to_a
  end

  fields :name, :position, :wishlist_id, :price_display, :created_at, :updated_at

  field :description do |item|
    item.notes
  end

  field :link do |item|
    item.url
  end

  field :price do |item|
    item.single_price&.to_s
  end

  field :exchange_participant_id do |_item, options|
    options[:participant_id]
  end

  field :photo_url

  field :has_photo do |item|
    item.photo.attached?
  end

  field :is_available do |item, options|
    claims_shown(item, options).sum(&:quantity) < item.quantity
  end

  field :claimed_quantity do |item, options|
    claims_shown(item, options).sum(&:quantity)
  end

  # The viewer's own mark, wherever they made it. Never who else took it.
  field :my_claim do |item, options|
    mine = claims_shown(item, options).find { |claim| claim.user_id == options[:viewer].id }
    mine && { status: mine.status }
  end
end
