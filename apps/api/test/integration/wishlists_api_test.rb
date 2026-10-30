require "test_helper"

class WishlistsApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @workspace = workspaces(:one)
    @wishlist = Wishlist.create!(
      user: @user,
      workspace: @workspace,
      name: "Birthday Wishlist",
      visibility: "private"
    )
  end

  # ============================================================================
  # Basic CRUD Tests
  # ============================================================================

  test "index returns wishlists for current user" do
    get wishlists_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
    assert json_response.any? { |w| w["id"] == @wishlist.id }
  end

  test "show returns a wishlist" do
    get wishlist_path(@wishlist), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal @wishlist.name, json_response["name"]
  end

  test "create creates a wishlist" do
    assert_difference("Wishlist.count") do
      post wishlists_path,
        headers: @auth_headers,
        params: { wishlist: { name: "Christmas List", visibility: "private" } },
        as: :json
    end
    assert_response :created
    assert_equal "Christmas List", Wishlist.last.name
  end

  test "update modifies a wishlist" do
    patch wishlist_path(@wishlist),
      headers: @auth_headers,
      params: { wishlist: { name: "Updated Wishlist" } },
      as: :json
    assert_response :success
    assert_equal "Updated Wishlist", @wishlist.reload.name
  end

  test "destroy removes a wishlist" do
    assert_difference("Wishlist.count", -1) do
      delete wishlist_path(@wishlist), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  test "cannot access another user's private wishlist" do
    user_two = users(:two)
    other_wishlist = Wishlist.create!(
      user: user_two,
      workspace: workspaces(:two),
      name: "Secret List",
      visibility: "private"
    )

    get wishlist_path(other_wishlist), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  # ============================================================================
  # Share/Revoke Tests
  # ============================================================================

  test "share generates a share token" do
    post share_wishlist_path(@wishlist), headers: @auth_headers, as: :json
    assert_response :success
    assert @wishlist.reload.share_token.present?
    assert_equal "shared", @wishlist.visibility
  end

  test "revoke_share removes share token" do
    @wishlist.update!(share_token: "test_token")

    delete revoke_share_wishlist_path(@wishlist), headers: @auth_headers, as: :json
    assert_response :success
    assert_nil @wishlist.reload.share_token
  end

  test "reveal_claims reveals hidden claims" do
    @wishlist.update!(anti_spoiler_enabled: true)

    post reveal_claims_wishlist_path(@wishlist), headers: @auth_headers, as: :json
    assert_response :success
  end

  # ============================================================================
  # Wishlist Items Tests
  # ============================================================================

  test "wishlist items index returns items" do
    item = @wishlist.wishlist_items.create!(name: "New Laptop", priority: 1)

    get wishlist_wishlist_items_path(@wishlist), headers: @auth_headers, as: :json
    assert_response :success
    assert json_response.any? { |i| i["id"] == item.id }
  end

  test "wishlist items create adds an item" do
    assert_difference("WishlistItem.count") do
      post wishlist_wishlist_items_path(@wishlist),
        headers: @auth_headers,
        params: { wishlist_item: { name: "Headphones", priority: 0 } },
        as: :json
    end
    assert_response :created
  end

  test "wishlist items update modifies an item" do
    item = @wishlist.wishlist_items.create!(name: "Old Name", priority: 0)

    patch wishlist_wishlist_item_path(@wishlist, item),
      headers: @auth_headers,
      params: { wishlist_item: { name: "New Name" } },
      as: :json
    assert_response :success
    assert_equal "New Name", item.reload.name
  end

  test "wishlist items destroy removes an item" do
    item = @wishlist.wishlist_items.create!(name: "To Delete", priority: 0)

    assert_difference("WishlistItem.count", -1) do
      delete wishlist_wishlist_item_path(@wishlist, item), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Wishlist Items Claim Tests
  # ============================================================================

  test "claim item creates a claim" do
    # Create a wishlist owned by another user that we can claim from
    user_two = users(:two)
    other_wishlist = Wishlist.create!(
      user: user_two,
      workspace: workspaces(:two),
      name: "Claimable List",
      visibility: "shared",
      share_token: "claim_test_token"
    )
    item = other_wishlist.wishlist_items.create!(name: "Claimable Item", priority: 0)

    # User one can't access wishlists in workspace_two, so expect 404
    post claim_wishlist_wishlist_item_path(other_wishlist, item),
      headers: @auth_headers,
      as: :json
    assert_response :not_found
  end

  test "unclaim item removes a claim" do
    item = @wishlist.wishlist_items.create!(name: "Claimed Item", priority: 0)
    # Create a claim first
    claim = item.claims.create!(
      user: @user,
      status: "reserved",
      claimed_at: Time.current
    )

    delete unclaim_wishlist_wishlist_item_path(@wishlist, item),
      headers: @auth_headers,
      as: :json
    assert_response :no_content
  end

  test "mark_purchased updates claim status" do
    item = @wishlist.wishlist_items.create!(name: "Purchased Item", priority: 0)
    # Create a claim first
    claim = item.claims.create!(
      user: @user,
      status: "reserved",
      claimed_at: Time.current
    )

    patch mark_purchased_wishlist_wishlist_item_path(@wishlist, item),
      headers: @auth_headers,
      as: :json
    assert_response :success
  end

  # ============================================================================
  # Wishlist Items Reorder Tests
  # ============================================================================

  test "reorder rejects malformed positions and rolls back invalid values" do
    first = @wishlist.wishlist_items.create!(name: "First", position: 1)
    second = @wishlist.wishlist_items.create!(name: "Second", position: 2)
    [ nil, [], "bad", { "invalid" => 0 }, { first.id => 4, second.id => -1 },
     { first.id => 4, second.id => 1.5 } ].each do |positions|
      patch reorder_wishlist_wishlist_items_path(@wishlist),
        headers: @auth_headers, params: { positions: positions }, as: :json
      assert_response :unprocessable_entity
      assert_equal 1, first.reload.position
      assert_equal 2, second.reload.position
    end
  end

  test "item quantities must be whole numbers" do
    post wishlist_wishlist_items_path(@wishlist), headers: @auth_headers,
      params: { wishlist_item: { name: "Fractional", quantity: 1.5 } }, as: :json
    assert_response :unprocessable_entity
  end

  test "reorder updates item positions" do
    item1 = @wishlist.wishlist_items.create!(name: "Item 1", priority: 0, position: 0)
    item2 = @wishlist.wishlist_items.create!(name: "Item 2", priority: 0, position: 1)

    patch reorder_wishlist_wishlist_items_path(@wishlist),
      headers: @auth_headers,
      params: { positions: { item1.id => 1, item2.id => 0 } },
      as: :json
    assert_response :success
  end

  # ============================================================================
  # Public Wishlist Tests
  # ============================================================================

  test "public wishlist show returns shared wishlist" do
    @wishlist.update!(visibility: "shared", share_token: "public_test_token")

    # No auth required
    get "/w/public_test_token", as: :json
    assert_response :success
    assert_equal @wishlist.name, json_response["name"]
  end

  test "public wishlist show returns 404 for invalid token" do
    get "/w/invalid_token", as: :json
    assert_response :not_found
  end

  test "public wishlist claim allows guest to claim item" do
    @wishlist.update!(visibility: "shared", share_token: "guest_claim_token")
    item = @wishlist.wishlist_items.create!(name: "Public Item", priority: 0)

    # Guest claim (no auth)
    post "/w/guest_claim_token/items/#{item.id}/claim",
      params: {
        claim: {
          claimer_name: "Guest User",
          claimer_email: "guest@example.com"
        }
      },
      as: :json
    assert_response :created
  end

  # ============================================================================
  # Guest Claim Management Tests
  # ============================================================================

  test "guest claim show returns claim details by token" do
    @wishlist.update!(visibility: "shared", share_token: "for_guest_claim")
    item = @wishlist.wishlist_items.create!(name: "Guest Item", priority: 0)
    claim = item.claims.create!(
      claimer_name: "Test Guest",
      claimer_email: "testguest@example.com",
      status: "reserved",
      claimed_at: Time.current,
      claim_token: "guest_claim_token_123"
    )

    get "/claim/guest_claim_token_123", as: :json
    assert_response :success
  end

  test "guest claim show returns 404 for invalid token" do
    get "/claim/invalid_guest_token", as: :json
    assert_response :not_found
  end

  test "guest claim update modifies the claim" do
    @wishlist.update!(visibility: "shared", share_token: "for_guest_update")
    item = @wishlist.wishlist_items.create!(name: "Update Item", priority: 0)
    claim = item.claims.create!(
      claimer_name: "Update Guest",
      claimer_email: "update@example.com",
      status: "reserved",
      claimed_at: Time.current,
      claim_token: "guest_update_token"
    )

    patch "/claim/guest_update_token",
      params: { claim: { status: "purchased" } },
      as: :json
    assert_response :success
  end

  test "guest claim destroy removes the claim" do
    @wishlist.update!(visibility: "shared", share_token: "for_guest_delete")
    item = @wishlist.wishlist_items.create!(name: "Delete Item", priority: 0)
    claim = item.claims.create!(
      claimer_name: "Delete Guest",
      claimer_email: "delete@example.com",
      status: "reserved",
      claimed_at: Time.current,
      claim_token: "guest_delete_token"
    )

    delete "/claim/guest_delete_token", as: :json
    assert_response :success
  end

  # ============================================================================
  # Anti-Spoiler Tests
  # ============================================================================

  test "an unrevealed claim looks like no claim to an owner with anti-spoiler on" do
    item = claimed_item(anti_spoiler: true)

    assert_claims_seen item, headers: @auth_headers, quantity: 0, count: 0
  end

  test "revealing claims shows them to the owner" do
    item = claimed_item(anti_spoiler: true)

    post reveal_claims_wishlist_path(@wishlist), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal 1, json_response["revealed_count"]

    assert_claims_seen item, headers: @auth_headers, quantity: 2, count: 1
  end

  test "a claim made after a reveal stays hidden from the owner" do
    item = claimed_item(anti_spoiler: true, quantity: 3)
    post reveal_claims_wishlist_path(@wishlist), headers: @auth_headers, as: :json
    assert_response :success

    item.claims.create!(claimer_name: "Late Guest", claimer_email: "late@example.com")

    assert_claims_seen item, headers: @auth_headers, quantity: 2, count: 1
  end

  test "a non-owner still sees unrevealed claims so they do not double up" do
    item = claimed_item(anti_spoiler: true)
    workspaces(:one).workspace_memberships.create!(user: users(:two), role: "member")

    assert_claims_seen item, headers: auth_headers_for(users(:two), workspace: workspaces(:one)), quantity: 2, count: 1
  end

  test "an owner with anti-spoiler off sees every claim" do
    item = claimed_item(anti_spoiler: false)

    assert_claims_seen item, headers: @auth_headers, quantity: 2, count: 1
  end

  test "guests still see unrevealed claims so they do not double up" do
    item = claimed_item(anti_spoiler: true)
    @wishlist.update!(visibility: "shared", share_token: "spoiler_public_token")

    get "/w/spoiler_public_token", as: :json

    assert_response :success
    assert_equal 2, json_response["claimed_count"]
    assert_item_claims json_response["wishlist_items"].find { |seen| seen["id"] == item.id }, item, quantity: 2, count: 1
  end

  # ============================================================================
  # Authentication Tests
  # ============================================================================

  test "requires authentication" do
    get wishlists_path, as: :json
    assert_response :unauthorized
  end

  private

  def claimed_item(anti_spoiler:, quantity: 2)
    @wishlist.update!(anti_spoiler_enabled: anti_spoiler, visibility: "workspace")
    item = @wishlist.wishlist_items.create!(name: "Surprise", quantity: quantity)
    item.claims.create!(claimer_name: "Early Guest", claimer_email: "early@example.com", quantity: 2)
    item
  end

  # Every place one viewer can read these numbers, so that none can give it away.
  def assert_claims_seen(item, headers:, quantity:, count:)
    get wishlists_path, headers: headers, as: :json
    assert_response :success
    assert_equal quantity, json_response.find { |seen| seen["id"] == @wishlist.id }["claimed_count"]

    get wishlist_path(@wishlist), headers: headers, as: :json
    assert_response :success
    assert_equal quantity, json_response["claimed_count"]
    assert_item_claims json_response["wishlist_items"].find { |seen| seen["id"] == item.id }, item, quantity: quantity, count: count

    get wishlist_wishlist_items_path(@wishlist), headers: headers, as: :json
    assert_response :success
    assert_item_claims json_response.find { |seen| seen["id"] == item.id }, item, quantity: quantity, count: count

    get wishlist_wishlist_item_path(@wishlist, item), headers: headers, as: :json
    assert_response :success
    assert_item_claims json_response, item, quantity: quantity, count: count
  end

  def assert_item_claims(seen, item, quantity:, count:)
    assert_equal quantity, seen["claimed_quantity"]
    assert_equal item.quantity - quantity, seen["available_quantity"]
    assert_equal quantity < item.quantity, seen["is_available"]
    assert_equal count, seen["claim_count"]
    assert_equal count, seen["claims"].size
  end
end
