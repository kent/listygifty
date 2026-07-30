require "test_helper"
require "securerandom"

class GiftExchangeLifecycleTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    @old_frontend_url = ENV["FRONTEND_URL"]
    ActiveJob::Base.queue_adapter = :test
    ENV["FRONTEND_URL"] = "https://listygifty.com"
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    clear_performed_jobs

    @organizer = create_exchange_user("organizer")
    @organizer_headers = auth_headers_for(@organizer)
    @exchange_date = 45.days.from_now.to_date
  end

  teardown do
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    clear_performed_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
    ENV["FRONTEND_URL"] = @old_frontend_url
  end

  test "complete production-style gift exchange lifecycle keeps matches and wishlists private" do
    exchange = create_exchange!
    invitees = [
      create_exchange_user("avery", first_name: "Avery"),
      create_exchange_user("blair", first_name: "Blair"),
      create_exchange_user("casey", first_name: "Casey")
    ]

    participants = invite_participants!(exchange, invitees)
    assert_invitation_emails_are_complete(exchange, participants)

    accept_invites!(exchange, participants, invitees)
    wishlist_items = build_participant_wishlists!(exchange, participants, invitees)
    update_wishlist_item!(exchange, participants.first, invitees.first, wishlist_items.first)

    assert_private_wishlist_locked_until_draw(exchange, participants, invitees)

    start_exchange!(exchange)
    assert_assignments_are_valid(exchange, participants)
    assert_match_emails_are_complete(exchange, participants)
    assert_organizer_cannot_see_secret_matches_or_wishlists(exchange, participants)
    assert_participants_can_only_see_their_own_match(exchange, participants, invitees)
  end

  private

  def create_exchange_user(label, first_name: nil)
    user = create_test_user(
      email: "#{label}-#{SecureRandom.hex(6)}@example.com",
      clerk_id: "user_#{label}_#{SecureRandom.hex(8)}"
    )
    user.update!(first_name: first_name) if first_name
    user
  end

  def create_exchange!
    post gift_exchanges_path,
      headers: @organizer_headers,
      params: {
        gift_exchange: {
          name: "Full Lifecycle Secret Santa",
          budget_min: 25,
          budget_max: 75,
          exchange_date: @exchange_date.iso8601,
          include_creator: false
        }
      },
      as: :json

    assert_response :created
    GiftExchange.find(json_response.fetch("id"))
  end

  def invite_participants!(exchange, invitees)
    participants = []

    perform_enqueued_jobs do
      invitees.each do |invitee|
        post gift_exchange_exchange_participants_path(exchange),
          headers: @organizer_headers,
          params: {
            exchange_participant: {
              name: "#{invitee.first_name} Gift Tester",
              email: invitee.email
            }
          },
          as: :json

        assert_response :created
        assert json_response["invite_token"].present?
        refute json_response.key?("matched_participant_id")
        participants << ExchangeParticipant.find(json_response.fetch("id"))
      end
    end

    assert_equal "inviting", exchange.reload.status
    assert_equal 3, participants.size
    participants
  end

  def assert_invitation_emails_are_complete(exchange, participants)
    invitation_emails = ActionMailer::Base.deliveries.select do |mail|
      mail.subject.include?("You're invited to #{exchange.name}")
    end
    assert_equal participants.size, invitation_emails.size

    participants.each do |participant|
      mail = invitation_emails.find { |item| item.to == [ participant.email ] }
      assert mail, "Missing invite email for #{participant.email}"

      text = body_part(mail, "text/plain")
      html = body_part(mail, "text/html")
      assert_includes text, exchange.name
      assert_includes text, participant.invite_token
      assert_includes text, "Add items to your wishlist"
      assert_includes text, "Get matched with someone"
      assert_includes text, "$25 - $75"
      assert_includes text, @exchange_date.strftime("%B %d, %Y")
      refute_includes text, "You're buying a gift for"
      assert_includes html, "Join the Exchange"
      assert_includes html, participant.invite_token
    end
  end

  def accept_invites!(exchange, participants, invitees)
    participants.zip(invitees).each do |participant, invitee|
      get "/exchange_invite/#{participant.invite_token}", as: :json
      assert_response :success
      assert_equal exchange.name, json_response.dig("exchange", "name")
      assert_equal "invited", json_response.dig("participant", "status")

      post "/exchange_invite/#{participant.invite_token}/accept",
        headers: auth_headers_for(invitee),
        as: :json

      assert_response :success
      assert_equal "accepted", participant.reload.status
      assert_equal invitee.id, participant.user_id
      assert_equal participant.id, json_response.dig("exchange", "my_participant", "id")

      get gift_exchanges_path, headers: auth_headers_for(invitee), as: :json
      assert_response :success
      assert json_response.any? { |item| item["id"] == exchange.id }
    end
  end

  def build_participant_wishlists!(exchange, participants, invitees)
    participants.zip(invitees).each_with_index.map do |(participant, invitee), index|
      post gift_exchange_exchange_participant_exchange_wishlist_items_path(exchange, participant),
        headers: auth_headers_for(invitee),
        params: {
          wishlist_item: {
            name: "Wishlist Item #{index + 1}",
            description: "A complete gift idea with size, style, and color notes.",
            link: "https://example.com/gifts/#{index + 1}",
            price: 30 + index
          }
        },
        as: :json

      assert_response :created
      ExchangeWishlistItem.find(json_response.fetch("id"))
    end
  end

  def update_wishlist_item!(exchange, participant, invitee, item)
    patch gift_exchange_exchange_participant_exchange_wishlist_item_path(exchange, participant, item),
      headers: auth_headers_for(invitee),
      params: {
        wishlist_item: {
          name: "Updated Cozy Scarf",
          description: "Soft wool, neutral colors preferred."
        }
      },
      as: :json

    assert_response :success
    assert_equal "Updated Cozy Scarf", item.reload.name
  end

  def assert_private_wishlist_locked_until_draw(exchange, participants, invitees)
    get gift_exchange_exchange_participant_exchange_wishlist_items_path(exchange, participants.second),
      headers: auth_headers_for(invitees.first),
      as: :json
    assert_response :forbidden

    get gift_exchange_exchange_participant_exchange_wishlist_items_path(exchange, participants.first),
      headers: @organizer_headers,
      as: :json
    assert_response :forbidden
  end

  def start_exchange!(exchange)
    perform_enqueued_jobs do
      post start_gift_exchange_path(exchange), headers: @organizer_headers, as: :json
    end

    assert_response :success
    assert_equal "active", exchange.reload.status
  end

  def assert_assignments_are_valid(exchange, participants)
    assignments = exchange.reload.exchange_participants.index_by(&:id).transform_values(&:matched_participant_id)

    assert_equal participants.map(&:id).sort, assignments.keys.sort
    assert_equal participants.map(&:id).sort, assignments.values.sort
    assignments.each do |giver_id, receiver_id|
      refute_equal giver_id, receiver_id
    end
  end

  def assert_match_emails_are_complete(exchange, participants)
    match_emails = ActionMailer::Base.deliveries.select do |mail|
      mail.subject.include?("Your Secret Santa match for #{exchange.name}")
    end
    assert_equal participants.size, match_emails.size

    participants.each do |participant|
      participant.reload
      match = participant.matched_participant
      mail = match_emails.find { |item| item.to == [ participant.user.email ] }
      assert mail, "Missing match email for #{participant.email}"

      text = body_part(mail, "text/plain")
      html = body_part(mail, "text/html")
      assert_includes text, match.display_name
      assert_includes text, "$25 - $75"
      assert_includes text, @exchange_date.strftime("%B %d, %Y")
      assert_includes text, "/exchanges/#{exchange.slug}/my-match"
      assert_includes text, "Keep it a secret"
      assert_includes html, "View Their Wishlist"

      secret_names = participants.map(&:display_name) - [ match.display_name ]
      secret_names.each do |name|
        refute_includes text, name
      end
    end
  end

  def assert_organizer_cannot_see_secret_matches_or_wishlists(exchange, participants)
    get gift_exchange_path(exchange), headers: @organizer_headers, as: :json
    assert_response :success
    json_response.fetch("exchange_participants").each do |participant_json|
      assert participant_json["invite_token"].present?
      refute participant_json.key?("matched_participant_id")
      refute participant_json.key?("matched_participant")
    end

    get gift_exchange_exchange_participant_exchange_wishlist_items_path(exchange, participants.first),
      headers: @organizer_headers,
      as: :json
    assert_response :forbidden
  end

  def assert_participants_can_only_see_their_own_match(exchange, participants, invitees)
    participants.zip(invitees).each do |participant, invitee|
      participant.reload
      matched_participant = participant.matched_participant
      unmatched_participant = participants.find do |candidate|
        candidate.id != participant.id && candidate.id != matched_participant.id
      end
      headers = auth_headers_for(invitee)

      get gift_exchange_path(exchange), headers: headers, as: :json
      assert_response :success
      assert_equal participant.id, json_response.dig("my_participant", "id")
      assert_equal matched_participant.id, json_response.dig("my_participant", "matched_participant_id")
      assert_equal matched_participant.display_name,
        json_response.dig("my_participant", "matched_participant", "display_name")
      roster = json_response.fetch("exchange_participants")
      assert_equal participants.map(&:id).sort, roster.pluck("id").sort
      roster.each do |participant_json|
        refute participant_json.key?("invite_token")
        refute participant_json.key?("matched_participant_id")
        refute participant_json.key?("matched_participant")
        refute participant_json.key?("wishlist_items")
      end

      get gift_exchange_exchange_participant_path(exchange, matched_participant),
        headers: headers,
        as: :json
      assert_response :success
      assert_equal matched_participant.id, json_response["id"]
      assert_equal matched_participant.exchange_wishlist_items.count, json_response.fetch("wishlist_items").size

      get gift_exchange_exchange_participant_exchange_wishlist_items_path(exchange, matched_participant),
        headers: headers,
        as: :json
      assert_response :success
      assert_equal matched_participant.exchange_wishlist_items.pluck(:name).sort,
        json_response.map { |item| item["name"] }.sort

      get gift_exchange_exchange_participant_path(exchange, unmatched_participant),
        headers: headers,
        as: :json
      assert_response :forbidden

      get gift_exchange_exchange_participant_exchange_wishlist_items_path(exchange, unmatched_participant),
        headers: headers,
        as: :json
      assert_response :forbidden
    end
  end

  def body_part(mail, content_type)
    part = mail.multipart? ? mail.parts.find { |item| item.content_type.start_with?(content_type) } : mail
    part.body.decoded
  end
end
