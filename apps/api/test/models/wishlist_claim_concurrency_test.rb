require "test_helper"
require_relative "../support/database_lock_assertions"

class WishlistClaimConcurrencyTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  include DatabaseLockAssertions

  setup do
    skip "Row-lock regression requires PostgreSQL" unless ActiveRecord::Base.connection.adapter_name == "PostgreSQL"
    @wishlist = Wishlist.create!(name: "Concurrent claims", workspace: workspaces(:one), user: users(:one))
    @item = @wishlist.wishlist_items.create!(name: "Gift", quantity: 2)
  end

  teardown do
    @wishlist&.destroy!
  end

  test "capacity validation waits for another claim to commit" do
    accepted = nil
    assert_waiting_mutation(@item, -> {
      accepted = WishlistItemClaim.create(wishlist_item_id: @item.id, claimer_email: "second@example.com", quantity: 2, status: "reserved").persisted?
    }) do
      @item.claims.create!(claimer_email: "first@example.com", quantity: 1, status: "reserved")
    end

    assert_not accepted
    assert_equal 1, @item.claimed_quantity
  end

  test "duplicate guest validation runs after another claim commits" do
    accepted = nil
    assert_waiting_mutation(@item, -> {
      accepted = WishlistItemClaim.create(wishlist_item_id: @item.id, claimer_email: "guest@example.com", status: "reserved").persisted?
    }) do
      @item.claims.create!(claimer_email: "guest@example.com", status: "reserved")
    end

    assert_not accepted
    assert_equal 1, @item.claims.count
  end
end
