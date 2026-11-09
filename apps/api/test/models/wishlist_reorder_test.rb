require "test_helper"

class WishlistReorderTest < ActiveSupport::TestCase
  setup do
    user = users(:one)
    @wishlist = user.personal_workspace.wishlists.create!(user: user, name: "Mine")
    @a = @wishlist.wishlist_items.create!(name: "A")
    @b = @wishlist.wishlist_items.create!(name: "B")
    @c = @wishlist.wishlist_items.create!(name: "C")
  end

  test "reorder! sets positions from the given order" do
    @wishlist.reorder!(item_ids: [ @c.id, @a.id, @b.id ])

    assert_equal [ @c, @a, @b ], @wishlist.wishlist_items.ordered.to_a
  end

  test "reorder! ignores archived items" do
    archived = @wishlist.wishlist_items.create!(name: "Old", archived_at: Time.current)

    @wishlist.reorder!(item_ids: [ @b.id, @c.id, @a.id ])

    assert_equal [ @b, @c, @a ], @wishlist.wishlist_items.active.ordered.to_a
    assert archived.reload.archived?
  end

  test "reorder! rejects a list that is missing or adds an item" do
    other = users(:two).personal_workspace.wishlists.create!(user: users(:two), name: "Theirs")
      .wishlist_items.create!(name: "X")

    assert_raises(ArgumentError) { @wishlist.reorder!(item_ids: [ @a.id, @b.id ]) }
    assert_raises(ArgumentError) { @wishlist.reorder!(item_ids: [ @a.id, @b.id, @c.id, other.id ]) }
    assert_raises(ArgumentError) { @wishlist.reorder!(item_ids: [ @a.id, @a.id, @b.id ]) }
    assert_equal [ @a, @b, @c ], @wishlist.wishlist_items.ordered.to_a
  end

  test "new items go to the end" do
    @wishlist.reorder!(item_ids: [ @c.id, @a.id, @b.id ])

    added = @wishlist.wishlist_items.create!(name: "D")

    assert_equal [ @c, @a, @b, added ], @wishlist.wishlist_items.ordered.to_a
  end

  test "ordered follows position, not priority" do
    @c.update!(priority: WishlistItem::PRIORITIES[:most_wanted])

    assert_equal [ @a, @b, @c ], @wishlist.wishlist_items.ordered.to_a
  end

  test "single_price is the top of the range, or the only price given" do
    assert_nil @a.single_price
    @a.update!(price_min: 20, price_max: 40)
    assert_equal 40, @a.single_price
    @a.update!(price_max: nil)
    assert_equal 20, @a.single_price
  end

  test "linked_exchanges lists exchanges where the owner uses this wishlist" do
    exchange = GiftExchange.create!(workspace: workspaces(:two), user: users(:two), name: "Giannone", budget_max: 50)
    exchange.exchange_participants.create!(user: users(:one), name: "Alice", email: users(:one).email, status: "accepted", wishlist: @wishlist)

    assert_equal [ exchange ], @wishlist.linked_exchanges.to_a
  end
end
