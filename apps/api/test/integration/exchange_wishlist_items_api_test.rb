require "test_helper"

class ExchangeWishlistItemsApiTest < ActionDispatch::IntegrationTest
  setup do
    @tempfiles = []
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @workspace = workspaces(:one)
    @exchange = GiftExchange.create!(
      workspace: @workspace,
      user: @user,
      name: "Secret Santa",
      budget_min: 20,
      budget_max: 50
    )
    @participant = @exchange.exchange_participants.create!(
      user: @user,
      name: @user.email,
      email: @user.email,
      status: "accepted"
    )
    @wishlist_item = @participant.wishlist!.wishlist_items.create!(
      name: "Cozy Sweater",
      notes: "Size medium",
      url: "https://example.com/sweater"
    )
  end
  teardown do
    @tempfiles.each { |file| file.close! }
  end


  # ============================================================================
  # Index Tests
  # ============================================================================

  test "index returns exchange wishlist items" do
    get gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: @auth_headers,
      as: :json
    assert_response :success
    assert_kind_of Array, json_response
    assert json_response.any? { |item| item["id"] == @wishlist_item.id }
  end

  # ============================================================================
  # Show Tests
  # ============================================================================

  test "show returns a wishlist item" do
    get gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
      headers: @auth_headers,
      as: :json
    assert_response :success
    assert_equal @wishlist_item.name, json_response["name"]
  end

  # ============================================================================
  # Create Tests
  # ============================================================================

  test "create adds a wishlist item" do
    assert_difference("WishlistItem.count") do
      post gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
        headers: @auth_headers,
        params: {
          wishlist_item: {
            name: "New Book",
            description: "Any genre is fine",
            link: "https://example.com/book"
          }
        },
        as: :json
    end
    assert_response :created
    item = WishlistItem.last
    assert_equal [ "New Book", "Any genre is fine", "https://example.com/book" ], [ item.name, item.notes, item.url ]
    assert_equal @participant.wishlist, item.wishlist
  end

  # ============================================================================
  # Update Tests
  # ============================================================================

  test "update modifies a wishlist item" do
    patch gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
      headers: @auth_headers,
      params: { wishlist_item: { name: "Updated Item Name" } },
      as: :json
    assert_response :success
    assert_equal "Updated Item Name", @wishlist_item.reload.name
  end

  test "update accepts a bounded authenticated image upload" do
    png = Base64.decode64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
    patch gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
      headers: @auth_headers,
      params: { wishlist_item: { photo: uploaded_file(png, "image/png", "photo.png") } }

    assert_response :success
    assert @wishlist_item.reload.photo.attached?
  end

  test "update rejects unsupported and oversized photo uploads" do
    [
      uploaded_file("not an image", "text/plain", "payload.txt"),
      uploaded_file("x" * (WishlistItem::MAX_PHOTO_BYTES + 1), "image/png", "too-large.png")
    ].each do |upload|
      patch gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
        headers: @auth_headers,
        params: { wishlist_item: { photo: upload } }
      assert_response :unprocessable_entity
      assert_not @wishlist_item.reload.photo.attached?
    end
  end

  # ============================================================================
  # Destroy Tests
  # ============================================================================

  test "destroy removes a wishlist item" do
    assert_difference("WishlistItem.count", -1) do
      delete gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
        headers: @auth_headers,
        as: :json
    end
    assert_response :success
  end

  test "destroy removes a wishlist item a giver was notified about" do
    notification = @exchange.exchange_notifications.create!(
      recipient_participant: @participant, wishlist_item: @wishlist_item, kind: "wishlist_item_added"
    )

    delete gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
      headers: @auth_headers,
      as: :json

    assert_response :success
    assert_not ExchangeNotification.exists?(notification.id)
  end

  test "direct upload and disk write endpoints are disabled" do
    assert_no_difference("ActiveStorage::Blob.count") do
      post "/rails/active_storage/direct_uploads",
        params: { blob: { filename: "attack.png", byte_size: 10, checksum: "x", content_type: "image/png" } },
        as: :json
    end
    assert_response :not_found

    put "/rails/active_storage/disk/forged-token", params: "bytes"
    assert_response :not_found
  end

  test "update rejects Active Storage signed IDs instead of bypassing byte quota" do
    blob = ActiveStorage::Blob.create_and_upload!(
      io: StringIO.new("image"),
      filename: "existing.png",
      content_type: "image/png"
    )

    patch gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
      headers: @auth_headers,
      params: { wishlist_item: { photo: blob.signed_id } },
      as: :json

    assert_response :unprocessable_entity
    assert_not @wishlist_item.reload.photo.attached?
  end


  # ============================================================================
  # One wishlist, every exchange
  # ============================================================================

  test "items added on one exchange show on the other exchange that uses the same wishlist" do
    other_exchange, other_participant = second_exchange_for(@user)

    post gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: @auth_headers, params: { wishlist_item: { name: "Mixer bowl", price: "40" } }, as: :json
    assert_response :created

    get gift_exchange_exchange_participant_exchange_wishlist_items_path(other_exchange, other_participant),
      headers: @auth_headers, as: :json
    assert_response :success
    assert_equal [ "Cozy Sweater", "Mixer bowl" ], json_response.map { _1["name"] }
    bowl = json_response.last
    assert_equal "40.0", bowl["price"]
    assert_equal "$40.00", bowl["price_display"]
    assert_equal 1, bowl["position"]
    assert_equal @participant.wishlist.id, bowl["wishlist_id"]
    assert_equal other_participant.id, bowl["exchange_participant_id"]
  end

  test "items from the Wishlists page show in the exchange, without archived ones" do
    @participant.wishlist.wishlist_items.create!(name: "Range item", price_min: 20, price_max: 40)
    @participant.wishlist.wishlist_items.create!(name: "Archived", archived_at: Time.current)

    get gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: @auth_headers, as: :json

    assert_equal [ "Cozy Sweater", "Range item" ], json_response.map { _1["name"] }
    assert_equal "40.0", json_response.last["price"]
    assert_equal "$20.00 - $40.00", json_response.last["price_display"]
  end

  test "a blank price clears the price" do
    @wishlist_item.update!(price_min: 10, price_max: 10)

    patch gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
      headers: @auth_headers, params: { wishlist_item: { price: "" } }, as: :json

    assert_response :success
    assert_equal [ nil, nil ], [ @wishlist_item.reload.price_min, @wishlist_item.price_max ]
  end

  test "someone joining with no wishlist gets one on their first add" do
    newcomer = users(:two)
    participant = @exchange.exchange_participants.create!(user: newcomer, name: "Bob", email: newcomer.email, status: "accepted")
    participant.update_columns(wishlist_id: nil)

    post gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, participant),
      headers: auth_headers_for(newcomer), params: { wishlist_item: { name: "Book" } }, as: :json

    assert_response :created
    assert_equal [ "Book" ], participant.reload.wishlist.wishlist_items.pluck(:name)
  end

  # ============================================================================
  # Order
  # ============================================================================

  test "reorder puts items in the given order for the owner and for their Secret Santa" do
    a = @wishlist_item
    b = @participant.wishlist.wishlist_items.create!(name: "B")
    c = @participant.wishlist.wishlist_items.create!(name: "C")
    santa = draw_with_santa

    patch reorder_gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: @auth_headers, params: { item_ids: [ c.id, a.id, b.id ] }, as: :json
    assert_response :success
    assert_equal [ c.id, a.id, b.id ], json_response.map { _1["id"] }

    get gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: auth_headers_for(santa), as: :json
    assert_response :success
    assert_equal [ c.id, a.id, b.id ], json_response.map { _1["id"] }
  end

  test "reorder with ids that don't match the list is rejected" do
    @participant.wishlist.wishlist_items.create!(name: "B")

    patch reorder_gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: @auth_headers, params: { item_ids: [ @wishlist_item.id ] }, as: :json

    assert_response :unprocessable_entity
  end

  test "only the owner can reorder" do
    santa = draw_with_santa

    patch reorder_gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: auth_headers_for(santa), params: { item_ids: [ @wishlist_item.id ] }, as: :json

    assert_response :forbidden
  end

  # ============================================================================
  # Choosing the wishlist
  # ============================================================================

  test "switching an exchange to another of my wishlists" do
    birthday = @user.personal_workspace.wishlists.create!(user: @user, name: "Birthday")

    patch wishlist_gift_exchange_exchange_participant_path(@exchange, @participant),
      headers: @auth_headers, params: { wishlist_id: birthday.id }, as: :json

    assert_response :success
    assert_equal({ "id" => birthday.id, "name" => "Birthday", "item_count" => 0 }, json_response["wishlist"])
    assert_equal birthday, @participant.reload.wishlist
  end

  test "can't switch an exchange to someone else's wishlist" do
    others = users(:two).personal_workspace.wishlists.create!(user: users(:two), name: "Bob's")

    patch wishlist_gift_exchange_exchange_participant_path(@exchange, @participant),
      headers: @auth_headers, params: { wishlist_id: others.id }, as: :json

    assert_response :not_found
    refute_equal others, @participant.reload.wishlist
  end

  test "can't choose the wishlist for someone else's place in the exchange" do
    other = @exchange.exchange_participants.create!(user: users(:two), name: "Bob", email: users(:two).email, status: "accepted")

    patch wishlist_gift_exchange_exchange_participant_path(@exchange, other),
      headers: @auth_headers, params: { wishlist_id: @participant.wishlist.id }, as: :json

    assert_response :forbidden
  end

  test "my participant shows which wishlist the exchange uses" do
    get gift_exchange_path(@exchange.slug), headers: @auth_headers, as: :json

    assert_equal({ "id" => @participant.wishlist.id, "name" => "My Wishlist", "item_count" => 1 },
      json_response.dig("my_participant", "wishlist"))
  end

  # ============================================================================
  # Notifications
  # ============================================================================

  test "adding to a shared list notifies the giver in every active exchange once" do
    draw_with_santa
    other_exchange, other_participant = second_exchange_for(@user)
    other_santa_user = User.create!(email: "carol@example.com", clerk_user_id: "user_carol")
    other_santa = other_exchange.exchange_participants.create!(user: other_santa_user, name: "Carol", email: "carol@example.com", status: "accepted")
    other_santa.update!(matched_participant: other_participant)
    other_exchange.update!(status: "active")

    assert_difference("ExchangeNotification.where(kind: 'wishlist_item_added').count", 2) do
      post gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
        headers: @auth_headers, params: { wishlist_item: { name: "Lamp" } }, as: :json
    end
    assert_equal [ @exchange.id, other_exchange.id ].sort,
      ExchangeNotification.where(kind: "wishlist_item_added").pluck(:gift_exchange_id).sort
  end

  test "a Secret Santa can still mark an older notice read after the owner switches lists" do
    santa = draw_with_santa
    post gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant),
      headers: @auth_headers, params: { wishlist_item: { name: "Lamp" } }, as: :json
    notification = ExchangeNotification.find_by!(kind: "wishlist_item_added")
    birthday = @user.personal_workspace.wishlists.create!(user: @user, name: "Birthday")
    @participant.update!(wishlist: birthday)

    patch read_gift_exchange_exchange_notification_path(@exchange, notification),
      headers: auth_headers_for(santa), as: :json

    assert_response :success
    assert notification.reload.read?
  end

  test "adding on the Wishlists page tells the Secret Santa too" do
    draw_with_santa

    assert_difference("ExchangeNotification.where(kind: 'wishlist_item_added').count", 1) do
      post wishlist_wishlist_items_path(@participant.wishlist),
        headers: auth_headers_for(@user, workspace: @user.personal_workspace),
        params: { wishlist_item: { name: "Candle" } }, as: :json
      assert_response :created
    end
  end

  test "adding through Claude or ChatGPT tells the Secret Santa too" do
    draw_with_santa
    key = ApiKey.generate_for(@user, name: "MCP", scopes: %w[read write]).raw_key

    assert_difference("ExchangeNotification.where(kind: 'wishlist_item_added').count", 1) do
      post "/mcp", headers: { "Authorization" => "Bearer #{key}", "Content-Type" => "application/json" }, params: {
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "create_wishlist_item", arguments: { wishlist_id: @participant.wishlist.id, name: "Candle" } }
      }.to_json
      assert_response :success
      assert_nil JSON.parse(response.body).dig("result", "isError")
    end
  end

  # ============================================================================
  # Authentication Tests
  # ============================================================================

  test "requires authentication" do
    get gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant), as: :json
    assert_response :unauthorized
  end
  private

  def second_exchange_for(user)
    exchange = GiftExchange.create!(workspace: workspaces(:two), user: users(:two), name: "Cottage", budget_max: 40)
    participant = exchange.exchange_participants.create!(name: "Alice", email: user.email)
    participant.accept!(user)
    [ exchange, participant ]
  end

  # Bob draws Alice, and the exchange goes live.
  def draw_with_santa
    santa = users(:two)
    giver = @exchange.exchange_participants.create!(user: santa, name: "Bob", email: santa.email, status: "accepted")
    giver.update!(matched_participant: @participant)
    @participant.update!(matched_participant: giver)
    @exchange.update!(status: "active")
    santa
  end

  def uploaded_file(contents, content_type, filename)
    tempfile = Tempfile.new([ "upload", File.extname(filename) ])
    tempfile.binmode
    tempfile.write(contents)
    tempfile.rewind
    @tempfiles << tempfile
    Rack::Test::UploadedFile.new(
      tempfile.path,
      content_type,
      original_filename: filename
    )
  end
end
