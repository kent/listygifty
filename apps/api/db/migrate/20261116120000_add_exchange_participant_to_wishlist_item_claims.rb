# A claim made from inside a gift exchange remembers the claimer's place in
# that exchange, so it can be removed when they can no longer see the list.
class AddExchangeParticipantToWishlistItemClaims < ActiveRecord::Migration[8.0]
  def change
    add_reference :wishlist_item_claims, :exchange_participant,
      null: true, index: true, foreign_key: { on_delete: :cascade }
  end
end
