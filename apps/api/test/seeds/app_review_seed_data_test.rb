require "test_helper"

class AppReviewSeedDataTest < ActiveSupport::TestCase
  setup do
    @clerk_key = ENV.delete("CLERK_SECRET_KEY")
  end

  teardown do
    ENV["CLERK_SECRET_KEY"] = @clerk_key if @clerk_key
  end

  test "the reviewer's match has a wishlist, and seeding twice adds nothing" do
    2.times { capture_io { Rails.application.load_seed } }

    reviewer = User.find_by!(email: "marie@gifts.com")
    exchange = GiftExchange.find_by!(user: reviewer, name: AppReviewSeedData::REVIEW_EXCHANGE[:name])
    mine = exchange.participant_for(reviewer)

    assert_equal [ "Coffee Subscription" ], mine.wishlist_items.map(&:name)
    assert_equal [ "Desk Plant" ], mine.matched_participant.wishlist_items.map(&:name)
    item = mine.matched_participant.wishlist_items.first
    assert_equal [ "Low-maintenance office plant.", "https://example.com/desk-plant", 28 ],
      [ item.notes, item.url, item.single_price.to_i ]
  end
end
