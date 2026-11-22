require "test_helper"

class McpPhotoToolsTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper
  include LocalHttpServer

  PHOTO_TOOLS = %w[
    create_gift update_gift create_wishlist_item update_wishlist_item
    create_exchange_wishlist_item update_exchange_wishlist_item
  ].freeze

  setup do
    @user = users(:one)
    @bob = users(:two)
    @workspace = workspaces(:one)
    WorkspaceMembership.find_or_create_by!(user: @user, workspace: @workspace) { |m| m.role = "owner" }
    @wishlist = Wishlist.create!(user: @user, workspace: @workspace, name: "Birthday")
    @headers = {}
  end

  test "tool schemas offer photo and fetch_photo_from_link, remove_photo on update, and image_url on wishlist items" do
    post "/mcp", params: { jsonrpc: "2.0", method: "tools/list", id: 1 }.to_json, headers: headers_for(@user)
    tools = JSON.parse(response.body).dig("result", "tools").index_by { |tool| tool["name"] }

    PHOTO_TOOLS.each do |name|
      properties = tools.dig(name, "inputSchema", "properties")
      assert_equal %w[data filename mime_type url], properties.dig("photo", "properties").keys.sort, name
      assert_equal false, properties.dig("photo", "additionalProperties"), name
      assert_includes properties.dig("photo", "description"), "SVG", name
      assert_equal "boolean", properties.dig("fetch_photo_from_link", "type"), name
      assert_equal name.start_with?("update_"), properties.key?("remove_photo"), name
      assert_equal name.end_with?("_wishlist_item") && !name.include?("exchange"), properties.key?("image_url"), name
      assert_includes tools.dig(name, "description"), "pulls the product's main picture", name
    end
  end

  test "create_wishlist_item stores base64 photo data and every read tool links to it" do
    item = payload(call_tool("create_wishlist_item", {
      wishlist_id: @wishlist.id, name: "Red sneakers",
      photo: { data: Base64.strict_encode64(PhotoBytes::PNG), mime_type: "image/png", filename: "sneakers.png" }
    }))

    assert_equal "image/png", WishlistItem.find(item["id"]).photo.content_type
    assert_match %r{\Ahttp://www\.example\.com/rails/active_storage/blobs/proxy/[^/]+/sneakers\.png\z}, item["photo_url"]
    assert_equal item["photo_url"], payload(call_tool("list_wishlist_items", { wishlist_id: @wishlist.id })).first["photo_url"]
    assert_equal item["photo_url"], payload(call_tool("get_wishlist", { wishlist_id: @wishlist.id }))["wishlist_items"].first["photo_url"]

    get item["photo_url"]
    assert_response :success
    assert_equal "image/png", response.media_type
    assert_equal "image/png", Marcel::MimeType.for(StringIO.new(response.body))
  end

  test "create_gift downloads a photo url, and get_gift and list_gifts return it" do
    holiday = holidays(:christmas)
    download = lambda do |url, **|
      assert_equal "https://shop.example/images/boots.jpg", url
      Photos::Download::Response.new(body: PhotoBytes.jpeg, content_type: "image/jpeg", url: url)
    end

    gift = Photos::Download.stub(:call, download) do
      payload(call_tool("create_gift", { holiday_id: holiday.id, name: "Boots", photo: { url: "https://shop.example/images/boots.jpg" } }))
    end

    assert_equal "image/jpeg", Gift.find(gift["id"]).photo.content_type
    assert_match %r{/boots\.jpg\z}, gift["photo_url"]
    assert_equal gift["photo_url"], payload(call_tool("get_gift", { gift_id: gift["id"] }))["photo_url"]
    listed = payload(call_tool("list_gifts", { holiday_id: holiday.id })).find { |row| row["id"] == gift["id"] }
    assert_equal gift["photo_url"], listed["photo_url"]
  end

  test "exchange wishlist items take a photo on create and a replacement on update" do
    exchange, participant = exchange_with(@user)
    ids = { exchange_id: exchange.id, participant_id: participant.id }

    item = payload(call_tool("create_exchange_wishlist_item", ids.merge(name: "Mug", photo: { data: Base64.strict_encode64(PhotoBytes::PNG) })))
    assert item["has_photo"]
    assert_match %r{/photo\.png\z}, item["photo_url"]

    updated = payload(call_tool("update_exchange_wishlist_item", ids.merge(item_id: item["id"], photo: { data: Base64.strict_encode64(PhotoBytes.gif) })))
    assert_match %r{/photo\.gif\z}, updated["photo_url"]
    assert_equal "image/gif", WishlistItem.find(item["id"]).photo.content_type
    assert_equal updated["photo_url"], payload(call_tool("list_exchange_wishlist_items", ids)).first["photo_url"]
  end

  test "other formats are converted, SVG is rasterized, and location metadata is stripped" do
    {
      PhotoBytes.tiff => "image/jpeg",
      PhotoBytes.ico => "image/png",
      %(<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><script>alert(1)</script><rect width="8" height="8"/></svg>) => "image/png",
      PhotoBytes.with_location(:jpeg) => "image/jpeg"
    }.each do |bytes, type|
      item = payload(call_tool("create_wishlist_item", { wishlist_id: @wishlist.id, name: "Thing", photo: { data: Base64.strict_encode64(bytes) } }))
      stored = WishlistItem.find(item["id"]).photo
      assert_equal type, stored.content_type
      assert_not_includes stored.download, PhotoBytes::LOCATION_MARKER
      assert_not_includes stored.download, "<svg"
    end
  end

  test "a photo far over the old 5 MB cap is stored" do
    big = PhotoBytes.vips::Image.gaussnoise(2000, 2000, sigma: 80).cast(:uchar).bandjoin([ 128, 128 ]).jpegsave_buffer(Q: 100)
    assert_operator big.bytesize, :>, 6 * 1024 * 1024
    gift = gifts(:sweater)

    payload(call_tool("update_gift", { gift_id: gift.id, photo: { data: Base64.strict_encode64(big) } }))

    assert_equal "image/jpeg", gift.reload.photo.content_type
  end

  test "an unsupported file type is refused, listing what works, and nothing is created" do
    assert_no_difference [ "WishlistItem.count", "ActiveStorage::Blob.count" ] do
      message = error(call_tool("create_wishlist_item", {
        wishlist_id: @wishlist.id, name: "Receipt",
        photo: { data: Base64.strict_encode64("%PDF-1.7\n%stuff"), mime_type: "application/pdf" }
      }))
      assert_includes message, "it looks like application/pdf"
      assert_includes message, Photos::Processor::ACCEPTED
    end
  end

  test "only someone who can edit the gift or item can set its photo, and nothing is downloaded first" do
    WorkspaceMembership.find_or_create_by!(user: @bob, workspace: @workspace) { |m| m.role = "member" }
    shared = Wishlist.create!(user: @user, workspace: @workspace, name: "Shared", visibility: "workspace")
    item = shared.wishlist_items.create!(name: "Kettle")
    exchange, alice = exchange_with(@user)
    exchange.exchange_participants.create!(user: @bob, name: "Bob", email: @bob.email, status: "accepted")
    exchange_item = alice.wishlist!.wishlist_items.create!(name: "Scarf")
    photo = { url: "https://shop.example/photo.jpg" }

    Photos::Download.stub(:call, ->(*, **) { flunk "downloaded a photo for a record the caller can't edit" }) do
      [
        [ "update_wishlist_item", { wishlist_id: shared.id, item_id: item.id, photo: photo } ],
        [ "update_wishlist_item", { wishlist_id: shared.id, item_id: item.id, image_url: photo[:url] } ],
        [ "create_wishlist_item", { wishlist_id: shared.id, name: "Sneaky", photo: photo } ],
        [ "update_gift", { gift_id: gifts(:book).id, photo: photo } ],
        [ "create_gift", { holiday_id: holidays(:birthday).id, name: "Sneaky", photo: photo } ],
        [ "update_exchange_wishlist_item", { exchange_id: exchange.id, participant_id: alice.id, item_id: exchange_item.id, photo: photo } ],
        [ "update_wishlist_item", { wishlist_id: shared.id, item_id: item.id, url: "https://shop.example/kettle", fetch_photo_from_link: true } ]
      ].each do |name, arguments|
        assert_includes error(call_tool(name, arguments, user: @bob)), "not found or is not accessible", name
      end
    end

    assert_equal 0, ActiveStorage::Attachment.count
    assert_no_enqueued_jobs only: LinkPhotoJob
  end

  test "remove_photo deletes the picture, including an old outside link" do
    gift = gifts(:sweater)
    gift.photo.attach(io: StringIO.new(PhotoBytes::PNG), filename: "sweater.png", content_type: "image/png")

    both = call_tool("update_gift", { gift_id: gift.id, remove_photo: true, photo: { data: Base64.strict_encode64(PhotoBytes::PNG) } })
    assert_includes error(both), "not both"
    assert gift.reload.photo.attached?

    assert_nil payload(call_tool("update_gift", { gift_id: gift.id, remove_photo: true }))["photo_url"]
    assert_not gift.reload.photo.attached?

    item = @wishlist.wishlist_items.create!(name: "Lamp", image_url: "https://cdn.example/lamp.jpg")
    assert_equal "https://cdn.example/lamp.jpg", payload(call_tool("list_wishlist_items", { wishlist_id: @wishlist.id })).first["photo_url"]
    cleared = payload(call_tool("update_wishlist_item", { wishlist_id: @wishlist.id, item_id: item.id, remove_photo: true }))
    assert_nil cleared["photo_url"]
    assert_nil cleared["image_url"]
  end

  test "image_url still works: it stores a copy like photo.url, or keeps the link if it can't be downloaded" do
    stored = with_http_server("/lamp.png" => http_ok(PhotoBytes::PNG, "image/png")) do |base|
      payload(call_tool("create_wishlist_item", { wishlist_id: @wishlist.id, name: "Lamp", image_url: "#{base}/lamp.png" }))
    end
    assert_equal "image/png", WishlistItem.find(stored["id"]).photo.content_type
    assert_nil stored["image_url"]
    assert_match %r{/rails/active_storage/blobs/proxy/.+/lamp\.png\z}, stored["photo_url"]

    linked = payload(call_tool("update_wishlist_item", { wishlist_id: @wishlist.id, item_id: stored["id"], image_url: "http://10.0.0.1/lamp.png" }))
    assert_equal "http://10.0.0.1/lamp.png", linked["image_url"]
    assert_equal "http://10.0.0.1/lamp.png", linked["photo_url"]
    assert_not WishlistItem.find(stored["id"]).photo.attached?, "a new link replaces the old photo"

    both = call_tool("create_wishlist_item", { wishlist_id: @wishlist.id, name: "Lamp", image_url: "https://x.example/a.png", photo: { url: "https://x.example/b.png" } })
    assert_includes error(both), "Send photo or image_url, not both"
  end

  test "a product link without a photo queues the product picture, on every item tool" do
    exchange, participant = exchange_with(@user)
    link = "https://shop.example/boots"
    created = {
      "create_wishlist_item" => { wishlist_id: @wishlist.id, name: "Boots", url: link },
      "create_gift" => { holiday_id: holidays(:christmas).id, name: "Boots", link: link },
      "create_exchange_wishlist_item" => { exchange_id: exchange.id, participant_id: participant.id, name: "Boots", link: link }
    }

    created.each do |name, arguments|
      result = nil
      assert_enqueued_with(job: LinkPhotoJob) { result = payload(call_tool(name, arguments)) }
      assert_equal true, result["photo_fetch_queued"], name
    end
    record_types = enqueued_jobs.select { |job| job["job_class"] == "LinkPhotoJob" }.map { |job| job["arguments"].first["_aj_globalid"][%r{/(\w+)/\d+\z}, 1] }
    assert_equal %w[WishlistItem Gift WishlistItem], record_types
  end

  test "an explicit photo, image_url, or fetch_photo_from_link: false means no fetch" do
    link = "https://shop.example/boots"
    Photos::Download.stub(:call, ->(url, **) { Photos::Download::Response.new(body: PhotoBytes::PNG, content_type: "image/png", url: url) }) do
      [
        { photo: { data: Base64.strict_encode64(PhotoBytes::PNG) } },
        { image_url: "https://cdn.example/boots.png" },
        { fetch_photo_from_link: false },
        { url: "" }
      ].each do |extra|
        result = nil
        assert_no_enqueued_jobs(only: LinkPhotoJob) do
          result = payload(call_tool("create_wishlist_item", { wishlist_id: @wishlist.id, name: "Boots", url: link }.merge(extra)))
        end
        assert_nil result["photo_fetch_queued"], extra.inspect
      end
    end
  end

  test "updates fetch for a new link on an item with no photo, and fetch_photo_from_link: true fetches again" do
    item = @wishlist.wishlist_items.create!(name: "Boots", url: "https://shop.example/old")
    ids = { wishlist_id: @wishlist.id, item_id: item.id }

    assert_no_enqueued_jobs(only: LinkPhotoJob) { call_tool("update_wishlist_item", ids.merge(name: "Brown boots")) }
    assert_no_enqueued_jobs(only: LinkPhotoJob) { call_tool("update_wishlist_item", ids.merge(url: "https://shop.example/old")) }
    assert_enqueued_with(job: LinkPhotoJob, args: [ item, "https://shop.example/new", @user, nil ]) do
      call_tool("update_wishlist_item", ids.merge(url: "https://shop.example/new"))
    end

    item.photo.attach(io: StringIO.new(PhotoBytes::PNG), filename: "mine.png", content_type: "image/png")
    assert_no_enqueued_jobs(only: LinkPhotoJob) { call_tool("update_wishlist_item", ids.merge(url: "https://shop.example/newer")) }
    assert_enqueued_with(job: LinkPhotoJob, args: [ item, "https://shop.example/newer", @user, item.photo.blob.id ]) do
      result = payload(call_tool("update_wishlist_item", ids.merge(fetch_photo_from_link: true)))
      assert_equal true, result["photo_fetch_queued"]
    end
  end

  test "the queued fetch attaches the picture from the product page" do
    routes = {
      "/boots" => ->(base) { http_ok(%(<meta property="og:image" content="#{base}/boots.bmp">), "text/html") },
      "/boots.bmp" => http_ok(PhotoBytes.bmp, "image/bmp")
    }
    item = with_http_server(routes) do |base|
      created = perform_enqueued_jobs(only: LinkPhotoJob) do
        payload(call_tool("create_wishlist_item", { wishlist_id: @wishlist.id, name: "Boots", url: "#{base}/boots" }))
      end
      payload(call_tool("list_wishlist_items", { wishlist_id: @wishlist.id })).find { |row| row["id"] == created["id"] }
    end

    assert_match %r{/boots\.jpg\z}, item["photo_url"]
  end

  test "a photo that would overfill the account's storage is refused" do
    Photos::Quota.stub(:used_bytes, Photos::Quota::LIMIT) do
      assert_no_difference "WishlistItem.count" do
        message = error(call_tool("create_wishlist_item", {
          wishlist_id: @wishlist.id, name: "Lamp", photo: { data: Base64.strict_encode64(PhotoBytes::PNG) }
        }))
        assert_includes message, "Photo storage is full"
      end
    end
  end

  private

  def headers_for(user)
    @headers[user.id] ||= begin
      key = ApiKey.generate_for(user, name: "Photo tools", scopes: %w[read write])
      { "Authorization" => "Bearer #{key.raw_key}", "Content-Type" => "application/json" }
    end
  end

  def call_tool(name, arguments, user: @user)
    post "/mcp", params: { jsonrpc: "2.0", method: "tools/call", params: { name: name, arguments: arguments }, id: 1 }.to_json,
      headers: headers_for(user)
    assert_response :success
    JSON.parse(response.body).fetch("result")
  end

  def payload(result)
    assert_not result["isError"], result.inspect
    JSON.parse(result.dig("content", 0, "text"))
  end

  def error(result)
    assert result["isError"], "expected an error, got #{result.inspect}"
    JSON.parse(result.dig("content", 0, "text")).fetch("error")
  end

  def exchange_with(user)
    exchange = GiftExchange.create!(workspace: @workspace, user: user, name: "Secret Santa")
    participant = exchange.exchange_participants.create!(user: user, name: "Alice", email: user.email, status: "accepted")
    [ exchange, participant ]
  end
end
