require "test_helper"

class WishlistClaimValidationTest < ActionDispatch::IntegrationTest
  setup do
    @workspace = workspaces(:one)
    @owner = users(:one)
    @claimer = users(:two)
    @workspace.workspace_memberships.create!(user: @claimer, role: "member")
    @wishlist = @workspace.wishlists.create!(user: @owner, name: "Claims", visibility: "shared")
    @item = @wishlist.wishlist_items.create!(name: "Gift", quantity: 5)
  end

  [ 0, -1, "invalid", "1.5" ].each do |quantity|
    test "guest quantity #{quantity.inspect} returns a validation error without creating a claim" do
      assert_no_difference("WishlistItemClaim.count") do
        post "/w/#{@wishlist.share_token}/items/#{@item.id}/claim",
          params: { claim: { claimer_name: "Guest", claimer_email: "guest@example.com", quantity: quantity } }, as: :json
      end
      assert_response :unprocessable_entity
    end

    test "authenticated quantity #{quantity.inspect} returns a validation error without creating a claim" do
      @wishlist.update!(visibility: "workspace")
      assert_no_difference("WishlistItemClaim.count") do
        post claim_wishlist_wishlist_item_path(@wishlist, @item),
          headers: auth_headers_for(@claimer, workspace: @workspace), params: { quantity: quantity }, as: :json
      end
      assert_response :unprocessable_entity
    end
  end

  test "an invalid guest email returns validation errors" do
    assert_no_difference("WishlistItemClaim.count") do
      post "/w/#{@wishlist.share_token}/items/#{@item.id}/claim",
        params: { claim: { claimer_name: "Guest", claimer_email: "not-an-email" } }, as: :json
    end
    assert_response :unprocessable_entity
  end

  test "a non-string guest email returns validation errors" do
    assert_no_difference("WishlistItemClaim.count") do
      post "/w/#{@wishlist.share_token}/items/#{@item.id}/claim",
        params: { claim: { claimer_name: "Guest", claimer_email: 123 } }, as: :json
    end
    assert_response :unprocessable_entity
  end

  test "archived items cannot be claimed through an authenticated endpoint" do
    @wishlist.update!(visibility: "workspace")
    @item.archive!
    assert_no_difference("WishlistItemClaim.count") do
      post claim_wishlist_wishlist_item_path(@wishlist, @item),
        headers: auth_headers_for(@claimer, workspace: @workspace), as: :json
    end
    assert_response :unprocessable_entity
  end

  test "returning a purchased guest claim to reserved clears its purchase date" do
    claim = @item.claims.create!(claimer_email: "guest@example.com", status: "purchased", purchased_at: 1.day.ago)
    patch "/claim/#{claim.claim_token}", params: { claim: { status: "reserved" } }, as: :json
    assert_response :success
    assert_nil claim.reload.purchased_at
  end

  test "model creation rejects a duplicate guest claim with normalized email" do
    @item.claims.create!(claimer_email: "guest@example.com", status: "reserved")
    duplicate = @item.claims.build(claimer_email: " GUEST@example.com ", status: "reserved")
    assert_not duplicate.save
    assert_equal 1, @item.claims.count
  end
end
