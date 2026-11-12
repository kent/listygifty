class ExchangeNotificationBlueprint < ApplicationBlueprint
  fields :kind, :read_at, :created_at, :updated_at

  field :gift_exchange_id do |notification|
    notification.gift_exchange_id
  end

  field :message do |notification|
    access_request = notification.wishlist_access_request
    case notification.kind
    when "wishlist_item_added"
      "Your match added a new wishlist item."
    when "wishlist_nudge"
      "Your Secret Santa would love a few more wishlist ideas."
    when "wishlist_access_requested"
      "Someone has requested to view your wishlist."
    when "wishlist_access_approved"
      "#{access_request.requested_participant.display_name} said yes. You can see their wishlist now."
    when "wishlist_access_denied"
      "#{access_request.requested_participant.display_name} would rather keep their wishlist private."
    end
  end

  field :wishlist_item_id do |notification|
    notification.wishlist_item_id
  end

  field :wishlist_access_request do |notification|
    access_request = notification.wishlist_access_request
    access_request && WishlistAccessRequestBlueprint.render_as_hash(access_request)
  end
end
