require "test_helper"
require "securerandom"

class SharedExchangeWishlistsTest < ActionDispatch::IntegrationTest
  setup do
    users = %w[Sofia Tomas Uma Victor Wren].map do |name|
      user = create_test_user(email: "#{name.downcase}-#{SecureRandom.hex(4)}@example.com", clerk_id: "user_#{SecureRandom.hex(6)}")
      user.update!(first_name: name)
      user
    end
    @organizer = users.first
    @exchange = GiftExchange.create!(user: @organizer, workspace: @organizer.personal_workspace, name: "Family", status: "inviting")
    @participants = users.map do |user|
      @exchange.exchange_participants.create!(user: user, name: user.first_name, email: user.email, status: "accepted")
    end
    @participants.each { |participant| participant.wishlist!.wishlist_items.create!(name: "Scarf for #{participant.name}") }

    post publish_gift_exchange_path(@exchange), headers: auth_headers_for(@organizer), as: :json
    assert_response :success

    @viewer = @participants.second.reload
    @match = @viewer.matched_participant
    # Neither the viewer's match nor the viewer's Santa.
    @other = @participants.find do |participant|
      participant != @viewer && participant != @match && participant.matched_participant != @viewer
    end
  end

  test "sharing opens every joined person's list to everyone else, after names are drawn" do
    assert_equal "none", show(@viewer, @other)["wishlist_access"]

    share(true)
    assert_response :success
    assert json_response["shared_wishlists"]

    peer = show(@viewer, @other)
    assert_equal "shared", peer["wishlist_access"]
    assert_equal [ "Scarf for #{@other.name}" ], peer.fetch("wishlist_items").pluck("name")
    get_items(@viewer, @other)
    assert_response :success
    assert_equal "match", show(@viewer, @match)["wishlist_access"]

    share(false)
    assert_response :success
    assert_equal "none", show(@viewer, @other)["wishlist_access"]
    refute show(@viewer, @other).key?("wishlist_items")
  end

  test "sharing never shows anyone who drew whom except their own match" do
    share(true)

    @participants.each do |viewer|
      viewer.reload
      peers = (@participants - [ viewer ]).map { |participant| [ participant, show(viewer, participant) ] }
      peers.each { |_participant, body| refute_match(/matched_participant/, body.to_json) }
      assert_equal [ viewer.matched_participant_id ],
        peers.select { |_participant, body| body["wishlist_access"] == "match" }.map { |participant, _body| participant.id }
      assert peers.all? { |_participant, body| %w[match shared].include?(body["wishlist_access"]) }

      get gift_exchange_path(@exchange), headers: headers_for(viewer), as: :json
      assert_response :success
      assert json_response["shared_wishlists"]
      refute_match(/matched_participant/, json_response["exchange_participants"].to_json)
      assert_equal viewer.matched_participant_id, json_response.dig("my_participant", "matched_participant_id")
    end
  end

  test "anyone can mark what they're getting, and the owner never sees it" do
    share(true)
    item = @other.wishlist_items.sole
    bystander = (@participants - [ @viewer, @other ]).first

    post claim_path(@other, item), headers: headers_for(@viewer), params: { purchased: true }, as: :json
    assert_response :created
    assert_equal({ "status" => "purchased" }, json_response["my_claim"])

    seen_by_bystander = show(bystander, @other).fetch("wishlist_items").sole
    refute seen_by_bystander["is_available"]
    assert_nil seen_by_bystander["my_claim"]

    get_items(@other, @other)
    assert_response :success
    seen_by_owner = json_response.sole
    assert seen_by_owner["is_available"]
    assert_equal 0, seen_by_owner["claimed_quantity"]
    assert_nil seen_by_owner["my_claim"]

    post claim_path(@other, item), headers: headers_for(@other), as: :json
    assert_response :forbidden
  end

  test "closing the lists keeps what people marked for when they open again" do
    share(true)
    item = @other.wishlist_items.sole
    post claim_path(@other, item), headers: headers_for(@viewer), as: :json
    assert_response :created

    share(false)
    assert item.claims.exists?

    share(true)
    assert_equal({ "status" => "reserved" }, show(@viewer, @other).fetch("wishlist_items").sole["my_claim"])
  end

  test "only the organizer can share, and after the draw nothing else can change" do
    patch gift_exchange_path(@exchange), headers: headers_for(@viewer), params: { gift_exchange: { shared_wishlists: true } }, as: :json
    assert_response :forbidden

    patch gift_exchange_path(@exchange), headers: auth_headers_for(@organizer),
      params: { gift_exchange: { name: "Renamed", shared_wishlists: true } }, as: :json
    assert_response :unprocessable_entity
    @exchange.reload
    assert_equal "Family", @exchange.name
    refute @exchange.shared_wishlists?
  end

  test "people who haven't joined can't see shared lists or be seen" do
    share(true)
    invited = @exchange.exchange_participants.create!(name: "Yara", email: "yara-#{SecureRandom.hex(3)}@example.com", status: "invited")
    assert_equal "unavailable", show(@viewer, invited)["wishlist_access"]

    leaver = create_test_user(email: "zane-#{SecureRandom.hex(3)}@example.com", clerk_id: "user_#{SecureRandom.hex(6)}")
    declined = @exchange.exchange_participants.create!(user: leaver, name: "Zane", email: leaver.email, status: "declined")
    get gift_exchange_exchange_participant_path(@exchange, @other), headers: auth_headers_for(declined.user), as: :json
    assert_response :success
    refute_equal "shared", json_response["wishlist_access"]
    refute json_response.key?("wishlist_items")
  end

  test "nobody needs to ask for a shared list, and nobody is told" do
    share(true)

    assert_no_difference -> { ExchangeNotification.count } do
      post gift_exchange_wishlist_access_requests_path(@exchange), headers: headers_for(@viewer), params: { participant_id: @other.id }, as: :json
    end
    assert_response :unprocessable_entity
    assert_equal "You can already see their wishlist", json_response["error"]
  end

  private

  def headers_for(participant)
    auth_headers_for(participant.user)
  end

  def share(shared)
    patch gift_exchange_path(@exchange), headers: auth_headers_for(@organizer), params: { gift_exchange: { shared_wishlists: shared } }, as: :json
  end

  def show(viewer, participant)
    get gift_exchange_exchange_participant_path(@exchange, participant), headers: headers_for(viewer), as: :json
    assert_response :success
    json_response
  end

  def get_items(viewer, participant)
    get gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, participant), headers: headers_for(viewer), as: :json
  end

  def claim_path(participant, item)
    claim_gift_exchange_exchange_participant_exchange_wishlist_item_path(@exchange, participant, item)
  end
end
