require "test_helper"

class Photos::QuotaTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @collaborator = users(:two)
    @wishlist = Wishlist.create!(user: @owner, workspace: workspaces(:one), name: "Birthday")
  end

  test "counts photos on the user's wishlists and on every Gift List they belong to" do
    item = attach(@wishlist.wishlist_items.create!(name: "Lamp"), 100)
    shared_gift = attach(gifts(:sweater), 200)
    attach(gifts(:book), 400)

    assert_equal 700, Photos::Quota.used_bytes(@owner)
    assert_equal 200, Photos::Quota.used_bytes(@collaborator), "the shared Christmas list counts for its collaborator too"
    assert_equal 600, Photos::Quota.used_bytes(@owner, except: item)
    assert_equal 0, Photos::Quota.used_bytes(@collaborator, except: shared_gift)
  end

  test "a replacement only has to fit alongside the user's other photos" do
    gift = attach(gifts(:sweater), Photos::Quota::LIMIT - 10)

    assert Photos::Quota.room_for?(@owner, gift, Photos::Quota::LIMIT - 10)
    assert_not Photos::Quota.room_for?(@owner, gifts(:book), 11)
    error = assert_raises(Photos::Invalid) { Photos::Quota.ensure_room!(@owner, gifts(:book), 11) }
    assert_includes error.message, "Photo storage is full"
    assert_includes error.message, "of the 1 GB limit"
  end

  private

  def attach(record, bytes)
    record.photo.attach(io: StringIO.new(PhotoBytes::PNG), filename: "photo.png", content_type: "image/png")
    record.photo.blob.update_columns(byte_size: bytes)
    record
  end
end
