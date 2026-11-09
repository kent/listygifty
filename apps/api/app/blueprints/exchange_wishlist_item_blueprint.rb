# An item on a person's wishlist, in the shape the exchange screens and older
# iOS builds already read. Pass `participant_id:` so each item says which
# exchange place it was read through.
class ExchangeWishlistItemBlueprint < ApplicationBlueprint
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

  field :photo_url do |item|
    if item.photo.attached?
      Rails.application.routes.url_helpers.rails_blob_path(item.photo, only_path: true)
    else
      item.image_url
    end
  end

  field :has_photo do |item|
    item.photo.attached?
  end
end
