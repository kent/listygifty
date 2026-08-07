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
    @wishlist_item = @participant.exchange_wishlist_items.create!(
      name: "Cozy Sweater",
      description: "Size medium",
      link: "https://example.com/sweater"
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
    assert_difference("ExchangeWishlistItem.count") do
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
    assert_equal "New Book", ExchangeWishlistItem.last.name
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
      uploaded_file("x" * (ExchangeWishlistItem::MAX_PHOTO_BYTES + 1), "image/png", "too-large.png")
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
    assert_difference("ExchangeWishlistItem.count", -1) do
      delete gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, @participant, @wishlist_item),
        headers: @auth_headers,
        as: :json
    end
    assert_response :success
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
  # Authentication Tests
  # ============================================================================

  test "requires authentication" do
    get gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, @participant), as: :json
    assert_response :unauthorized
  end
  private

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
