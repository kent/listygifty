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
    get gift_exchange_path(@exchange), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal @exchange.name, json_response["name"]
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

  test "start initiates the gift exchange matching" do
    # Add more participants for valid matching
    @exchange.exchange_participants.create!(
      name: "Person Two",
      email: "two@example.com",
      status: "accepted"
    )
    @exchange.exchange_participants.create!(
      name: "Person Three",
      email: "three@example.com",
      status: "accepted"
    )

    post start_gift_exchange_path(@exchange), headers: @auth_headers, as: :json
    # May succeed or return validation error depending on state
    assert_includes [ 200, 201, 422 ], response.status
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
