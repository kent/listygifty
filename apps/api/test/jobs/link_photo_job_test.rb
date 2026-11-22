require "test_helper"

class LinkPhotoJobTest < ActiveJob::TestCase
  include LocalHttpServer

  setup do
    @user = users(:one)
    @wishlist = Wishlist.create!(user: @user, workspace: workspaces(:one), name: "Birthday")
  end

  test "attaches the product picture from the item's link" do
    with_product_page do |link|
      item = @wishlist.wishlist_items.create!(name: "Boots", url: link)

      LinkPhotoJob.perform_now(item, link, @user)

      assert_equal "image/png", item.reload.photo.content_type
    end
  end

  test "works for gifts too" do
    with_product_page do |link|
      gift = gifts(:sweater)
      gift.update!(link: link)

      LinkPhotoJob.perform_now(gift, link, @user)

      assert gift.reload.photo.attached?
    end
  end

  test "leaves a photo set in the meantime alone" do
    with_product_page do |link|
      item = @wishlist.wishlist_items.create!(name: "Boots", url: link)
      item.photo.attach(io: StringIO.new(PhotoBytes::PNG), filename: "mine.png", content_type: "image/png")

      LinkPhotoJob.perform_now(item, link, @user)

      assert_equal "mine.png", item.reload.photo.filename.to_s
    end
  end

  test "replaces the photo it was asked to replace" do
    with_product_page do |link|
      item = @wishlist.wishlist_items.create!(name: "Boots", url: link)
      item.photo.attach(io: StringIO.new(PhotoBytes::PNG), filename: "old.png", content_type: "image/png")

      LinkPhotoJob.perform_now(item, link, @user, item.photo.blob.id)

      assert_equal "boots.png", item.reload.photo.filename.to_s
    end
  end

  test "does nothing when the link changed after it was queued" do
    with_product_page do |link|
      item = @wishlist.wishlist_items.create!(name: "Boots", url: "https://other.example/boots")

      LinkPhotoJob.perform_now(item, link, @user)

      assert_not item.reload.photo.attached?
    end
  end

  test "gives up quietly when the page can't be fetched or has no picture" do
    with_http_server("/plain" => http_ok("<title>Boots</title>", "text/html")) do |base|
      [ "#{base}/plain", "#{base}/missing", "http://10.0.0.1/boots" ].each do |link|
        item = @wishlist.wishlist_items.create!(name: "Boots", url: link)

        assert_nothing_raised { LinkPhotoJob.perform_now(item, link, @user) }
        assert_not item.reload.photo.attached?, link
      end
    end
  end

  test "is dropped when the item was deleted before it ran" do
    item = @wishlist.wishlist_items.create!(name: "Boots", url: "https://shop.example/boots")
    LinkPhotoJob.perform_later(item, item.url, @user)
    item.destroy!

    assert_nothing_raised { perform_enqueued_jobs }
  end

  private

  def with_product_page
    routes = {
      "/boots" => ->(base) { http_ok(%(<meta property="og:image" content="#{base}/boots.png">), "text/html") },
      "/boots.png" => http_ok(PhotoBytes::PNG, "image/png")
    }
    with_http_server(routes) { |base| yield "#{base}/boots" }
  end
end
