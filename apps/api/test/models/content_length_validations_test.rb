require "test_helper"

class ContentLengthValidationsTest < ActiveSupport::TestCase
  test "bounds long-form person gift and wishlist content" do
    person = people(:mom)
    person.notes = "n" * 5_001
    assert_not person.valid?
    assert person.errors[:notes].any?

    gift = gifts(:sweater)
    gift.description = "d" * 5_001
    assert_not gift.valid?
    assert gift.errors[:description].any?

    wishlist = Wishlist.new(
      user: users(:one),
      workspace: workspaces(:one),
      name: "Wishlist",
      description: "w" * 5_001
    )
    assert_not wishlist.valid?
    assert wishlist.errors[:description].any?

    item = wishlist.wishlist_items.new(name: "Item", notes: "i" * 5_001)
    assert_not item.valid?
    assert item.errors[:notes].any?
  end
end
