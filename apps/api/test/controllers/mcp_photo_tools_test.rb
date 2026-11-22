require "test_helper"
require "minitest/mock"

class McpPhotoToolsTest < ActionDispatch::IntegrationTest
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

  test "tool schemas offer photo on create and update, and remove_photo on update" do
    post "/mcp", params: { jsonrpc: "2.0", method: "tools/list", id: 1 }.to_json, headers: headers_for(@user)
    tools = JSON.parse(response.body).dig("result", "tools").index_by { |tool| tool["name"] }

    PHOTO_TOOLS.each do |name|
      properties = tools.dig(name, "inputSchema", "properties")
      assert_equal %w[data filename mime_type url], properties.dig("photo", "properties").keys.sort, name
      assert_equal false, properties.dig("photo", "additionalProperties"), name
      assert_equal name.start_with?("update_"), properties.key?("remove_photo"), name
      assert_includes tools.dig(name, "description"), "photo", name
    end
    assert_not tools.dig("create_wishlist_item", "inputSchema", "properties").key?("image_url")
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
    assert_equal PhotoBytes::PNG, response.body
  end

  test "create_gift downloads a photo url, and get_gift and list_gifts return it" do
    holiday = holidays(:christmas)
    fetch = lambda do |url|
      assert_equal "https://shop.example/images/boots.jpg", url
      PhotoBytes::JPEG
    end

    gift = Photos::RemoteImage.stub(:fetch, fetch) do
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

    updated = payload(call_tool("update_exchange_wishlist_item", ids.merge(item_id: item["id"], photo: { data: Base64.strict_encode64(PhotoBytes::GIF) })))
    assert_match %r{/photo\.gif\z}, updated["photo_url"]
    assert_equal "image/gif", WishlistItem.find(item["id"]).photo.content_type
    assert_equal updated["photo_url"], payload(call_tool("list_exchange_wishlist_items", ids)).first["photo_url"]
  end

  test "an unsupported file type is refused and nothing is created" do
    assert_no_difference [ "WishlistItem.count", "ActiveStorage::Blob.count" ] do
      message = error(call_tool("create_wishlist_item", {
        wishlist_id: @wishlist.id, name: "Receipt",
        photo: { data: Base64.strict_encode64("%PDF-1.7\n%stuff"), mime_type: "application/pdf" }
      }))
      assert_includes message, "it looks like application/pdf"
    end
  end

  test "a photo over 5 MB fits in the request but is refused" do
    gift = gifts(:sweater)
    too_big = PhotoBytes::PNG + ("\x00".b * HasPhoto::MAX_PHOTO_BYTES)

    message = error(call_tool("update_gift", { gift_id: gift.id, photo: { data: Base64.strict_encode64(too_big) } }))

    assert_includes message, "over the 5 MB limit"
    assert_not gift.reload.photo.attached?
  end

  test "only someone who can edit the gift or item can set its photo, and nothing is downloaded first" do
    WorkspaceMembership.find_or_create_by!(user: @bob, workspace: @workspace) { |m| m.role = "member" }
    shared = Wishlist.create!(user: @user, workspace: @workspace, name: "Shared", visibility: "workspace")
    item = shared.wishlist_items.create!(name: "Kettle")
    exchange, alice = exchange_with(@user)
    exchange.exchange_participants.create!(user: @bob, name: "Bob", email: @bob.email, status: "accepted")
    exchange_item = alice.wishlist!.wishlist_items.create!(name: "Scarf")
    photo = { url: "https://shop.example/photo.jpg" }

    Photos::RemoteImage.stub(:fetch, ->(*) { flunk "downloaded a photo for a record the caller can't edit" }) do
      [
        [ "update_wishlist_item", { wishlist_id: shared.id, item_id: item.id, photo: photo } ],
        [ "create_wishlist_item", { wishlist_id: shared.id, name: "Sneaky", photo: photo } ],
        [ "update_gift", { gift_id: gifts(:book).id, photo: photo } ],
        [ "create_gift", { holiday_id: holidays(:birthday).id, name: "Sneaky", photo: photo } ],
        [ "update_exchange_wishlist_item", { exchange_id: exchange.id, participant_id: alice.id, item_id: exchange_item.id, photo: photo } ]
      ].each do |name, arguments|
        assert_includes error(call_tool(name, arguments, user: @bob)), "not found or is not accessible", name
      end
    end

    assert_equal 0, ActiveStorage::Attachment.count
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
