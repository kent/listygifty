require "test_helper"
require "securerandom"

class GiftExchangeNotificationsTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    clear_performed_jobs

    @users = 5.times.map do |index|
      user = create_test_user(
        email: "exchange-user-#{index}-#{SecureRandom.hex(4)}@example.com",
        clerk_id: "user_exchange_#{index}_#{SecureRandom.hex(5)}"
      )
      user.update!(first_name: %w[Olivia Parker Quinn Riley Sage][index])
      user
    end
    @organizer = @users.first
    @exchange = GiftExchange.create!(
      user: @organizer,
      workspace: @organizer.personal_workspace,
      name: "Five Person Exchange",
      status: "inviting"
    )
    @participants = @users.map do |user|
      @exchange.exchange_participants.create!(
        user: user,
        name: user.first_name,
        email: user.email,
        status: "accepted"
      )
    end
  end

  teardown do
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    clear_performed_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
  end

  test "five users publish with exclusions, receive private updates, and nudge only their match" do
    exclusions = [
      [ @participants[0], @participants[1] ],
      [ @participants[2], @participants[3] ]
    ]
    exclusions.each do |left, right|
      @exchange.exchange_exclusions.create!(participant_a: left, participant_b: right)
    end

    perform_enqueued_jobs do
      post publish_gift_exchange_path(@exchange),
        headers: auth_headers_for(@organizer),
        as: :json
    end

    assert_response :success
    assert_equal "active", @exchange.reload.status
    assert @exchange.published_at.present?
    assert_equal 5, @participants.filter_map { |participant| participant.reload.matched_participant_id }.uniq.size
    exclusions.each do |left, right|
      refute_equal right.id, left.reload.matched_participant_id
      refute_equal left.id, right.reload.matched_participant_id
    end

    reveal_emails = ActionMailer::Base.deliveries.select do |mail|
      mail.subject.include?("The names are in")
    end
    assert_equal 5, reveal_emails.size
    reveal_emails.each do |mail|
      body = mail.text_part.body.decoded
      recipient = @participants.find { |participant| participant.user.email == mail.to.first }
      (@participants - [ recipient ]).each do |participant|
        refute_includes body, participant.display_name
      end
      assert_includes body, "Show me my match"
    end

    giver = @participants.first.reload
    recipient = giver.matched_participant
    unrelated = @participants.find do |participant|
      participant.id != giver.id && participant.matched_participant_id != recipient.id
    end

    perform_enqueued_jobs do
      post gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, recipient),
        headers: auth_headers_for(recipient.user),
        params: { wishlist_item: { name: "A new private idea" } },
        as: :json
    end

    assert_response :created
    notification = @exchange.exchange_notifications.find_by!(
      recipient_participant: giver,
      kind: "wishlist_item_added"
    )
    assert_nil @exchange.exchange_notifications.find_by(
      recipient_participant: unrelated,
      kind: "wishlist_item_added"
    )
    refute notification.read?

    get gift_exchange_exchange_notifications_path(@exchange),
      headers: auth_headers_for(giver.user),
      as: :json
    assert_response :success
    assert_equal [ notification.id ], json_response.pluck("id")
    refute json_response.first.key?("recipient_participant_id")
    refute json_response.first.key?("actor_id")

    patch read_gift_exchange_exchange_notification_path(@exchange, notification),
      headers: auth_headers_for(giver.user),
      as: :json
    assert_response :success
    assert notification.reload.read?

    perform_enqueued_jobs do
      post nudge_match_gift_exchange_path(@exchange),
        headers: auth_headers_for(giver.user),
        as: :json
    end
    assert_response :created

    nudge = @exchange.exchange_notifications.find_by!(
      recipient_participant: recipient,
      kind: "wishlist_nudge"
    )
    nudge_mail = ActionMailer::Base.deliveries.find do |mail|
      mail.subject.include?("Your Secret Santa needs a little help")
    end
    assert_equal [ recipient.user.email ], nudge_mail.to
    nudge_body = nudge_mail.text_part.body.decoded
    assert_includes nudge_body, "request is anonymous"
    refute_includes nudge_body, giver.display_name

    post nudge_match_gift_exchange_path(@exchange),
      headers: auth_headers_for(giver.user),
      as: :json
    assert_response :unprocessable_entity
    assert_equal nudge.id, @exchange.exchange_notifications.where(kind: "wishlist_nudge").sole.id

    get gift_exchange_exchange_notifications_path(@exchange),
      headers: auth_headers_for(unrelated.user),
      as: :json
    assert_response :success
    assert_empty json_response
  end

  test "publishing with enough accepted participants closes pending invitations" do
    pending = @exchange.exchange_participants.create!(
      name: "Pending Person",
      email: "pending-#{SecureRandom.hex(4)}@example.com",
      status: "invited"
    )

    perform_enqueued_jobs do
      post publish_gift_exchange_path(@exchange),
        headers: auth_headers_for(@organizer),
        as: :json
    end

    assert_response :success
    assert_equal "declined", pending.reload.status
    reveal_emails = ActionMailer::Base.deliveries.select do |mail|
      mail.subject.include?("The names are in")
    end
    assert_equal @participants.size, reveal_emails.size
    refute reveal_emails.any? { |mail| mail.to.include?(pending.email) }

    post "/exchange_invite/#{pending.invite_token}/accept",
      headers: auth_headers_for(create_test_user(
        email: pending.email,
        clerk_id: "user_pending_#{SecureRandom.hex(4)}"
      )),
      as: :json
    assert_response :unprocessable_entity
  end

  test "an organizer can delete an exchange after assignments exist" do
    post publish_gift_exchange_path(@exchange),
      headers: auth_headers_for(@organizer),
      as: :json
    assert_response :success

    assert_difference("GiftExchange.count", -1) do
      delete gift_exchange_path(@exchange),
        headers: auth_headers_for(@organizer),
        as: :json
    end
    assert_response :no_content
  end

  test "published exchange structure is immutable through organizer endpoints" do
    post publish_gift_exchange_path(@exchange),
      headers: auth_headers_for(@organizer),
      as: :json
    assert_response :success

    original_name = @exchange.reload.name
    patch gift_exchange_path(@exchange),
      headers: auth_headers_for(@organizer),
      params: { gift_exchange: { name: "Changed", status: "inviting" } },
      as: :json
    assert_response :unprocessable_entity
    assert_equal original_name, @exchange.reload.name
    assert_equal "active", @exchange.status

    post gift_exchange_exchange_participants_path(@exchange),
      headers: auth_headers_for(@organizer),
      params: {
        exchange_participant: {
          name: "Too Late",
          email: "too-late-#{SecureRandom.hex(4)}@example.com"
        }
      },
      as: :json
    assert_response :unprocessable_entity

    post gift_exchange_exchange_exclusions_path(@exchange),
      headers: auth_headers_for(@organizer),
      params: {
        exchange_exclusion: {
          participant_a_id: @participants.first.id,
          participant_b_id: @participants.second.id
        }
      },
      as: :json
    assert_response :unprocessable_entity
  end
end
