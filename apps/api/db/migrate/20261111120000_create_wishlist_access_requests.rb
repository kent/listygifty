# Someone in an exchange can ask to see the wishlist of a person they didn't
# draw, and that person says yes or no. One request per pair, and the
# notifications about it go when it does.
class CreateWishlistAccessRequests < ActiveRecord::Migration[8.1]
  def change
    create_table :wishlist_access_requests do |t|
      t.references :gift_exchange, null: false, foreign_key: true
      t.references :requester_participant, null: false, index: false,
        foreign_key: { to_table: :exchange_participants, on_delete: :cascade }
      t.references :requested_participant, null: false,
        foreign_key: { to_table: :exchange_participants, on_delete: :cascade }
      t.string :status, null: false, default: "pending"
      t.datetime :decided_at
      t.timestamps
    end
    add_index :wishlist_access_requests, %i[requester_participant_id requested_participant_id],
      unique: true, name: "index_wishlist_access_requests_on_pair"

    add_reference :exchange_notifications, :wishlist_access_request, foreign_key: { on_delete: :cascade }
  end
end
