class ExchangeNotificationBlueprint < ApplicationBlueprint
  fields :kind, :read_at, :created_at, :updated_at

  field :gift_exchange_id do |notification|
    notification.gift_exchange_id
  end

  field :message do |notification|
    case notification.kind
    when "wishlist_item_added"
      "Your match added a new wishlist item."
    when "wishlist_nudge"
      "Your Secret Santa would love a few more wishlist ideas."
    end
  end

  field :wishlist_item_id do |notification|
    notification.exchange_wishlist_item_id
  end
end
