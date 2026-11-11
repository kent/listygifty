class WishlistItemClaimBlueprint < ApplicationBlueprint
  fields :status, :quantity, :message, :claimed_at, :purchased_at, :created_at, :updated_at

  field :wishlist_item_id do |claim|
    claim.wishlist_item_id
  end

  field :is_guest do |claim|
    claim.guest?
  end

  field :claimer do |claim|
    if claim.guest?
      {
        name: claim.claimer_name,
        is_guest: true
      }
    else
      {
        id: claim.user.id,
        name: claim.user.safe_name,
        image_url: claim.user.image_url,
        is_guest: false
      }
    end
  end

  # Only include claim_token in specific contexts (guest management)
  field :claim_token do |claim, options|
    claim.claim_token if options[:include_claim_token]
  end

  view :with_item do
    association :wishlist_item, blueprint: WishlistItemBlueprint
  end

  view :for_guest do
    field :claim_token do |claim|
      claim.claim_token
    end
  end
end
