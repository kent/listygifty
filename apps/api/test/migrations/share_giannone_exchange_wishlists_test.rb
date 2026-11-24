require "test_helper"
require Rails.root.join("db/migrate/20261124120100_share_giannone_exchange_wishlists").to_s

class ShareGiannoneExchangeWishlistsTest < ActiveSupport::TestCase
  test "shares wishlists in the Giannone exchange and nowhere else" do
    user = users(:one)
    giannone = GiftExchange.create!(user: user, workspace: user.personal_workspace, name: "Giannone XMas 2026", status: "active")
    other = GiftExchange.create!(user: user, workspace: user.personal_workspace, name: "Cottage", status: "active")
    assert_equal ShareGiannoneExchangeWishlists::SLUG, giannone.slug

    ActiveRecord::Migration.suppress_messages { ShareGiannoneExchangeWishlists.new.up }

    assert giannone.reload.shared_wishlists?
    refute other.reload.shared_wishlists?
  end
end
