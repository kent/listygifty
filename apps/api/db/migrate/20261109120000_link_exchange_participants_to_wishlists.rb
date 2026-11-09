# Exchanges stop keeping their own wishlist items. Each participant points at
# a real wishlist the person owns, so the same list shows in every exchange,
# on the Wishlists page, and to every Secret Santa.
#
# The old API keeps serving while this runs, and it still reads and writes
# exchange_wishlist_items, so nothing here removes or renames what it uses.
# ExchangeWishlistBackfill marks every row it copies, and it can run again
# after the new API is live to pick up rows written in between.
class LinkExchangeParticipantsToWishlists < ActiveRecord::Migration[8.0]
  def up
    unless column_exists?(:exchange_participants, :wishlist_id)
      add_reference :exchange_participants, :wishlist, foreign_key: { on_delete: :nullify }
    end
    unless column_exists?(:exchange_notifications, :wishlist_item_id)
      add_reference :exchange_notifications, :wishlist_item, foreign_key: { on_delete: :cascade }
    end
    unless column_exists?(:exchange_wishlist_items, :wishlist_item_id)
      add_reference :exchange_wishlist_items, :wishlist_item, foreign_key: { on_delete: :cascade }
    end

    # New code no longer destroys old rows itself, so deleting a participant
    # or an old item must not trip these keys.
    replace_foreign_key :exchange_wishlist_items, :exchange_participants, on_delete: :cascade
    replace_foreign_key :exchange_notifications, :exchange_wishlist_items, on_delete: :nullify
    # Deleting a copied item or list deletes the old row it came from, so a
    # later backfill run can't copy it back.
    replace_foreign_key :exchange_wishlist_items, :wishlist_items, on_delete: :cascade

    ExchangeWishlistBackfill.call
  end

  def down
    replace_foreign_key :exchange_notifications, :exchange_wishlist_items, on_delete: nil
    replace_foreign_key :exchange_wishlist_items, :exchange_participants, on_delete: nil
    remove_reference :exchange_wishlist_items, :wishlist_item, foreign_key: true
    remove_reference :exchange_notifications, :wishlist_item, foreign_key: true
    remove_reference :exchange_participants, :wishlist, foreign_key: true
  end

  private

  def replace_foreign_key(from_table, to_table, on_delete:)
    existing = foreign_keys(from_table).find { |key| key.to_table == to_table.to_s }
    return if existing&.on_delete == on_delete

    remove_foreign_key from_table, to_table if existing
    add_foreign_key from_table, to_table, on_delete: on_delete
  end
end
