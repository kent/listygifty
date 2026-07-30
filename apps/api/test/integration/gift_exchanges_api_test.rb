require "test_helper"

class GiftExchangesApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @workspace = workspaces(:one)
    @exchange = GiftExchange.create!(
      workspace: @workspace,
      user: @user,
      name: "Secret Santa 2024",
      budget_min: 20,
      budget_max: 50,
      exchange_date: 1.month.from_now
    )
    @participant = @exchange.exchange_participants.create!(
      user: @user,
      name: @user.email,
      email: @user.email,
      status: "accepted"
    )
  end

  # ============================================================================
  # Basic CRUD Tests
  # ============================================================================

  test "index returns gift exchanges for workspace" do
    get gift_exchanges_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
    assert json_response.any? { |e| e["id"] == @exchange.id }
  end

  test "show returns a gift exchange" do
    get gift_exchange_path(@exchange.slug), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal @exchange.name, json_response["name"]
    assert_equal @exchange.slug, json_response["slug"]
  end

  test "joined participant sees the full participant roster without private invite data" do
    joined_user = users(:two)
    joined_participant = @exchange.exchange_participants.create!(
      user: joined_user,
      name: "Joined Person",
      email: joined_user.email,
      status: "accepted"
    )
    invited_participant = @exchange.exchange_participants.create!(
      name: "Pending Invite",
      email: "pending@example.com",
      status: "invited"
    )

    get gift_exchange_path(@exchange.slug), headers: auth_headers_for(joined_user), as: :json

    assert_response :success
    roster = json_response.fetch("exchange_participants")
    assert_equal [ @participant.id, joined_participant.id, invited_participant.id ].sort, roster.pluck("id").sort
    assert_equal joined_participant.id, json_response.dig("my_participant", "id")
    assert_equal "invited", roster.find { |participant| participant["id"] == invited_participant.id }.fetch("status")
    roster.each do |participant_json|
      refute participant_json.key?("email")
      refute participant_json.key?("invite_token")
      refute participant_json.key?("matched_participant_id")
      refute participant_json.key?("matched_participant")
      refute participant_json.key?("wishlist_items")
    end
  end

  test "create creates a gift exchange" do
    assert_difference("GiftExchange.count") do
      assert_difference("ExchangeParticipant.count") do
        post gift_exchanges_path,
          headers: @auth_headers,
          params: {
            gift_exchange: {
              name: "Holiday Gift Exchange",
              budget_min: 25,
              budget_max: 75,
              exchange_date: 2.months.from_now
            }
          },
          as: :json
      end
    end
    assert_response :created
    exchange = GiftExchange.last
    creator_participant = exchange.participant_for(@user)
    assert_equal "Holiday Gift Exchange", exchange.name
    assert_equal "holiday-gift-exchange", json_response["slug"]
    assert_equal "accepted", creator_participant.status
    assert_equal @user.email, creator_participant.email
    assert_equal creator_participant.id, json_response.dig("my_participant", "id")
    assert_equal 1, json_response["participant_count"]
    assert_equal 1, json_response["accepted_count"]
  end

  test "create can skip adding the organizer as a participant" do
    assert_difference("GiftExchange.count") do
      assert_no_difference("ExchangeParticipant.count") do
        post gift_exchanges_path,
          headers: @auth_headers,
          params: {
            gift_exchange: {
              name: "Organizer Only Exchange",
              include_creator: false
            }
          },
          as: :json
      end
    end

    assert_response :created
    assert_nil json_response["my_participant"]
    assert_equal 0, json_response["participant_count"]
  end

  test "create derives a unique slug from the exchange name" do
    post gift_exchanges_path,
      headers: @auth_headers,
      params: { gift_exchange: { name: @exchange.name } },
      as: :json

    assert_response :created
    assert_equal "secret-santa-2024-2", json_response["slug"]
  end

  test "create returns validation errors" do
    assert_no_difference("GiftExchange.count") do
      post gift_exchanges_path,
        headers: @auth_headers,
        params: {
          gift_exchange: {
            name: "",
            budget_min: 75,
            budget_max: 25
          }
        },
        as: :json
    end

    assert_response :unprocessable_entity
    assert json_response["errors"].any?
  end

  test "update modifies a gift exchange" do
    patch gift_exchange_path(@exchange),
      headers: @auth_headers,
      params: { gift_exchange: { name: "Updated Exchange Name" } },
      as: :json
    assert_response :success
    assert_equal "Updated Exchange Name", @exchange.reload.name
  end

  test "destroy removes a gift exchange" do
    assert_difference("GiftExchange.count", -1) do
      delete gift_exchange_path(@exchange), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  test "cannot access exchange from another workspace" do
    user_two = users(:two)
    other_exchange = GiftExchange.create!(
      workspace: workspaces(:two),
      user: user_two,
      name: "Other Exchange",
      budget_min: 10,
      budget_max: 30
    )

    get gift_exchange_path(other_exchange), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  # ============================================================================
  # Exchange Participants Tests
  # ============================================================================

  test "participants index returns exchange participants" do
    get gift_exchange_exchange_participants_path(@exchange), headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
    assert json_response.any? { |p| p["id"] == @participant.id }
  end

  test "participants index exposes invite status but not private invite data to non-owners" do
    joined_user = users(:two)
    joined_participant = @exchange.exchange_participants.create!(
      user: joined_user,
      name: "Joined Person",
      email: joined_user.email,
      status: "accepted"
    )
    invited_participant = @exchange.exchange_participants.create!(
      name: "Pending Invite",
      email: "pending@example.com",
      status: "invited"
    )

    get gift_exchange_exchange_participants_path(@exchange),
      headers: auth_headers_for(joined_user),
      as: :json

    assert_response :success
    assert_equal [ @participant.id, joined_participant.id, invited_participant.id ].sort, json_response.pluck("id").sort
    assert_equal "invited",
      json_response.find { |participant| participant["id"] == invited_participant.id }.fetch("status")
    assert json_response.none? { |participant_json| participant_json.key?("email") }
    assert json_response.none? { |participant_json| participant_json.key?("invite_token") }
  end

  test "participants show returns a participant" do
    get gift_exchange_exchange_participant_path(@exchange, @participant),
      headers: @auth_headers,
      as: :json
    assert_response :success
    assert_equal @participant.email, json_response["email"]
  end

  test "participants create adds a participant" do
    assert_difference("ExchangeParticipant.count") do
      post gift_exchange_exchange_participants_path(@exchange),
        headers: @auth_headers,
        params: { exchange_participant: { name: "New Person", email: "new@example.com" } },
        as: :json
    end
    assert_response :created
  end

  test "participants update modifies a participant" do
    patch gift_exchange_exchange_participant_path(@exchange, @participant),
      headers: @auth_headers,
      params: { exchange_participant: { name: "Updated Name" } },
      as: :json
    assert_response :success
    assert_equal "Updated Name", @participant.reload.name
  end

  test "participants destroy removes a participant" do
    # Create a participant to delete
    new_participant = @exchange.exchange_participants.create!(
      name: "To Remove",
      email: "remove@example.com",
      status: "invited"
    )

    assert_difference("ExchangeParticipant.count", -1) do
      delete gift_exchange_exchange_participant_path(@exchange, new_participant),
        headers: @auth_headers,
        as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Exchange Exclusions Tests
  # ============================================================================

  test "exclusions index returns exchange exclusions" do
    get gift_exchange_exchange_exclusions_path(@exchange), headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
  end

  test "exclusions create adds an exclusion" do
    # Add another participant to exclude
    other_participant = @exchange.exchange_participants.create!(
      name: "Other Person",
      email: "other@example.com",
      status: "accepted"
    )

    assert_difference("ExchangeExclusion.count") do
      post gift_exchange_exchange_exclusions_path(@exchange),
        headers: @auth_headers,
        params: {
          exchange_exclusion: {
            participant_a_id: @participant.id,
            participant_b_id: other_participant.id
          }
        },
        as: :json
    end
    assert_response :created
  end

  test "exclusions destroy removes an exclusion" do
    other_participant = @exchange.exchange_participants.create!(
      name: "Other",
      email: "other@example.com",
      status: "accepted"
    )
    exclusion = ExchangeExclusion.create!(
      gift_exchange: @exchange,
      participant_a: @participant,
      participant_b: other_participant
    )

    assert_difference("ExchangeExclusion.count", -1) do
      delete gift_exchange_exchange_exclusion_path(@exchange, exclusion),
        headers: @auth_headers,
        as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Exchange Start Tests
  # ============================================================================

  test "two joined participants can publish and are matched to each other" do
    second_participant = @exchange.exchange_participants.create!(
      name: "Person Two",
      email: "two@example.com",
      status: "accepted"
    )
    @exchange.update!(status: "inviting")

    post start_gift_exchange_path(@exchange), headers: @auth_headers, as: :json

    assert_response :success
    assert_equal "active", @exchange.reload.status
    assert_equal second_participant.id, @participant.reload.matched_participant_id
    assert_equal @participant.id, second_participant.reload.matched_participant_id
  end

  test "one joined participant cannot publish" do
    @exchange.update!(status: "inviting")

    post start_gift_exchange_path(@exchange), headers: @auth_headers, as: :json

    assert_response :unprocessable_entity
    assert_equal "inviting", @exchange.reload.status
    assert_nil @participant.reload.matched_participant_id
  end

  test "owner can reopen a published exchange and edit it again" do
    joined_participants = 2.times.map do |index|
      user = create_test_user(
        email: "redo-joined-#{index}@example.com",
        clerk_id: "user_redo_joined_#{index}"
      )
      @exchange.exchange_participants.create!(
        user: user,
        name: "Joined #{index}",
        email: user.email,
        status: "accepted"
      )
    end
    pending = @exchange.exchange_participants.create!(
      name: "Still deciding",
      email: "redo-pending@example.com",
      status: "invited"
    )
    @exchange.update!(status: "inviting")
    ExchangeDrawingService.new(@exchange).publish!

    assert_equal "declined", pending.reload.status
    assert @exchange.exchange_participants.accepted.all? { |participant| participant.matched_participant_id.present? }

    post redo_gift_exchange_path(@exchange),
      headers: @auth_headers,
      params: { mode: "reopen" },
      as: :json

    assert_response :success
    assert_equal "inviting", @exchange.reload.status
    assert_nil @exchange.published_at
    assert_equal "invited", pending.reload.status
    assert_equal "accepted", @participant.reload.status
    assert joined_participants.all? { |participant| participant.reload.status == "accepted" }
    assert @exchange.exchange_participants.none? { |participant| participant.matched_participant_id.present? }
    assert json_response.dig("capabilities", "publish")
    refute json_response.dig("capabilities", "redo")

    post gift_exchange_exchange_participants_path(@exchange),
      headers: @auth_headers,
      params: { exchange_participant: { name: "New Person", email: "redo-new@example.com" } },
      as: :json
    assert_response :created
  end

  test "owner can redraw names but a participant cannot" do
    users_and_participants = 3.times.map do |index|
      user = create_test_user(
        email: "redraw-joined-#{index}@example.com",
        clerk_id: "user_redraw_joined_#{index}"
      )
      participant = @exchange.exchange_participants.create!(
        user: user,
        name: "Redraw #{index}",
        email: user.email,
        status: "accepted"
      )
      [ user, participant ]
    end
    @exchange.update!(status: "inviting")
    ExchangeDrawingService.new(@exchange).publish!
    first_draw = @exchange.exchange_participants.pluck(:id, :matched_participant_id).to_h

    post redo_gift_exchange_path(@exchange),
      headers: auth_headers_for(users_and_participants.first.first),
      params: { mode: "redraw" },
      as: :json
    assert_response :forbidden

    post redo_gift_exchange_path(@exchange),
      headers: @auth_headers,
      params: { mode: "redraw" },
      as: :json

    assert_response :success
    assert_equal "active", @exchange.reload.status
    @exchange.exchange_participants.each do |participant|
      refute_equal first_draw.fetch(participant.id), participant.matched_participant_id
    end
    assert json_response.dig("capabilities", "redo")
  end

  # ============================================================================
  # Resend Invite Tests
  # ============================================================================

  test "resend_invite sends invitation email again" do
    invited_participant = @exchange.exchange_participants.create!(
      name: "Invited Person",
      email: "invited@example.com",
      status: "invited"
    )

    post resend_invite_gift_exchange_exchange_participant_path(@exchange, invited_participant),
      headers: @auth_headers,
      as: :json
    assert_response :success
    assert json_response["message"].present?
  end

  test "resend_invite fails for accepted participant" do
    post resend_invite_gift_exchange_exchange_participant_path(@exchange, @participant),
      headers: @auth_headers,
      as: :json
    # Should return error for already accepted
    assert_includes [ 400, 422 ], response.status
  end

  # ============================================================================
  # Exchange Invite Token Tests
  # ============================================================================

  test "exchange invite show returns invite by token" do
    pending_participant = @exchange.exchange_participants.create!(
      name: "Invited Person",
      email: "invited@example.com",
      status: "invited",
      invite_token: "test_invite_token"
    )

    get "/exchange_invite/test_invite_token", as: :json
    assert_response :success
    assert_equal @exchange.name, json_response["exchange"]["name"]
  end

  test "exchange invite accept joins the exchange" do
    @exchange.update!(status: "inviting")
    pending_participant = @exchange.exchange_participants.create!(
      name: "Invited Person",
      email: "invited@example.com",
      status: "invited",
      invite_token: "accept_test_token"
    )

    user_two = users(:two)
    user_two_headers = auth_headers_for(user_two)

    post "/exchange_invite/accept_test_token/accept", headers: user_two_headers, as: :json
    assert_response :success
    assert_equal "accepted", pending_participant.reload.status
  end

  test "exchange invite decline rejects the invitation" do
    @exchange.update!(status: "inviting")
    pending_participant = @exchange.exchange_participants.create!(
      name: "Invited Person",
      email: "decline@example.com",
      status: "invited",
      invite_token: "decline_test_token"
    )

    user_two = users(:two)
    user_two_headers = auth_headers_for(user_two)

    post "/exchange_invite/decline_test_token/decline", headers: user_two_headers, as: :json
    assert_response :success
    assert_equal "declined", pending_participant.reload.status
  end

  # ============================================================================
  # Authentication Tests
  # ============================================================================

  test "requires authentication" do
    get gift_exchanges_path, as: :json
    assert_response :unauthorized
  end
end
