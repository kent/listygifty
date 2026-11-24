# The organizer can open every joined person's exchange wishlist to everyone
# else in the exchange. Who drew whom stays as private as before.
class AddSharedWishlistsToGiftExchanges < ActiveRecord::Migration[8.1]
  def change
    add_column :gift_exchanges, :shared_wishlists, :boolean, null: false, default: false
  end
end
