require "test_helper"
require "securerandom"

class WishlistAccessRequestsTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    ActionMailer::Base.deliveries.clear

    users = %w[Olivia Parker Quinn Riley].map do |name|
      user = create_test_user(email: "#{name.downcase}-#{SecureRandom.hex(4)}@example.com", clerk_id: "user_#{SecureRandom.hex(6)}")
      user.update!(first_name: name)
      user
    end
    @exchange = GiftExchange.create!(user: users.first, workspace: users.first.personal_workspace, name: "Cousins", status: "inviting")
    @participants = users.map do |user|
      @exchange.exchange_participants.create!(user: user, name: user.first_name, email: user.email, status: "accepted")
    end
    @participants.each { |participant| participant.wishlist!.wishlist_items.create!(name: "Socks for #{participant.name}") }

    post publish_gift_exchange_path(@exchange), headers: auth_headers_for(users.first), as: :json
    assert_response :success
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs

    @asker = @participants.second.reload
    @match = @asker.matched_participant
    # Neither the asker's match nor the asker's Santa, so the answer can't hint at either.
    @other = @participants.find do |participant|
      participant != @asker && participant != @match && participant.matched_participant != @asker
    end
  end

  teardown do
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
  end

  test "asking, and a yes, tells each side and opens the list" do
    assert_equal "none", show(@asker, @other).fetch("wishlist_access")
    refute show(@asker, @other).key?("wishlist_items")
    get_items(@asker, @other)
    assert_response :forbidden

    perform_enqueued_jobs { ask(@asker, @other) }
    assert_response :created
    assert_equal "pending", json_response["status"]
    assert_equal @asker.display_name, json_response["requester_name"]
    assert_equal "pending", show(@asker, @other).fetch("wishlist_access")

    request_mail = ActionMailer::Base.deliveries.sole
    assert_equal [ @other.email ], request_mail.to
    assert_includes request_mail.subject, "#{@asker.display_name} wants to see your wishlist"

    notification = notifications_for(@other).sole
    assert_equal "wishlist_access_requested", notification["kind"]
    assert_equal "#{@asker.display_name} asked to see your wishlist.", notification["message"]
    access_request_id = notification.dig("wishlist_access_request", "id")
    assert_equal "pending", notification.dig("wishlist_access_request", "status")

    ask(@asker, @other)
    assert_response :unprocessable_entity
    assert_includes json_response["error"], "already asked"

    ActionMailer::Base.deliveries.clear
    perform_enqueued_jobs { answer(@other, access_request_id, :approve) }
    assert_response :success
    assert_equal "approved", json_response["status"]
    assert notifications_for(@other).sole["read_at"].present?

    approval_mail = ActionMailer::Base.deliveries.sole
    assert_equal [ @asker.email ], approval_mail.to
    assert_includes approval_mail.text_part.decoded, "/exchanges/#{@exchange.slug}/participants/#{@other.id}"
    approval = notifications_for(@asker).sole
    assert_equal "wishlist_access_approved", approval["kind"]
    assert_equal "#{@other.display_name} said yes. You can see their wishlist now.", approval["message"]

    peer = show(@asker, @other)
    assert_equal "approved", peer["wishlist_access"]
    assert_equal [ "Socks for #{@other.name}" ], peer.fetch("wishlist_items").pluck("name")
    get_items(@asker, @other)
    assert_response :success
    assert_equal [ "Socks for #{@other.name}" ], json_response.pluck("name")

    answer(@other, access_request_id, :deny)
    assert_response :unprocessable_entity
    assert_equal "approved", WishlistAccessRequest.find(access_request_id).status
  end

  test "a no tells the asker, keeps the list closed, and can't be asked again" do
    ask(@asker, @other)
    perform_enqueued_jobs { answer(@other, json_response["id"], :deny) }
    assert_response :success

    denial_mail = ActionMailer::Base.deliveries.sole
    assert_equal [ @asker.email ], denial_mail.to
    assert_includes denial_mail.subject, "keeping their wishlist private"
    assert_equal "wishlist_access_denied", notifications_for(@asker).sole["kind"]

    assert_equal "denied", show(@asker, @other)["wishlist_access"]
    refute show(@asker, @other).key?("wishlist_items")
    get_items(@asker, @other)
    assert_response :forbidden

    assert_no_difference -> { ExchangeNotification.count } do
      ask(@asker, @other)
    end
    assert_response :unprocessable_entity
  end

  test "only the person asked can answer" do
    ask(@asker, @other)
    access_request_id = json_response["id"]
    bystander = (@participants - [ @asker, @other ]).first

    [ @asker, bystander ].each do |intruder|
      answer(intruder, access_request_id, :approve)
      assert_response :not_found
    end
    assert_equal "pending", WishlistAccessRequest.find(access_request_id).status

    stranger = create_test_user(email: "stranger-#{SecureRandom.hex(3)}@example.com", clerk_id: "user_#{SecureRandom.hex(6)}")
    post wishlist_access_requests_path, headers: auth_headers_for(stranger), params: { participant_id: @other.id }, as: :json
    assert_response :not_found
  end

  test "your own match and your own list need no asking, and nobody is told" do
    assert_equal "match", show(@asker, @match)["wishlist_access"]

    assert_no_enqueued_emails do
      assert_no_difference -> { ExchangeNotification.count } do
        ask(@asker, @match)
        assert_response :unprocessable_entity
        ask(@asker, @asker)
        assert_response :unprocessable_entity
      end
    end
  end

  test "nothing about a request shows anyone else's match" do
    ask(@asker, @other)
    asked = json_response
    answer(@other, asked["id"], :approve)
    answered = json_response

    [ asked, answered, show(@asker, @other), show(@other, @asker), notifications_for(@other), notifications_for(@asker) ].each do |body|
      refute_match(/matched_participant/, body.to_json)
    end
    refute show(@asker, @other).key?("email")
  end

  test "someone who hasn't joined can't be asked" do
    invited = @exchange.exchange_participants.create!(name: "Sage", email: "sage-#{SecureRandom.hex(3)}@example.com", status: "invited")

    assert_equal "unavailable", show(@asker, invited)["wishlist_access"]
    ask(@asker, invited)
    assert_response :unprocessable_entity
  end

  test "a redraw keeps answers and clears only notices about the draw" do
    ask(@asker, @other)
    answer(@other, json_response["id"], :approve)
    @exchange.exchange_notifications.create!(recipient_participant: @asker, kind: "wishlist_nudge")

    ExchangeDrawingService.new(@exchange.reload).redraw!

    assert_equal %w[wishlist_access_approved wishlist_access_requested],
      @exchange.exchange_notifications.pluck(:kind).sort
    assert @asker.reload.can_see_wishlist_of?(@other)
  end

  test "a person who leaves takes their requests and the notices about them" do
    ask(@asker, @other)

    @asker.reload.anonymize!

    assert_empty WishlistAccessRequest.where(gift_exchange: @exchange)
    assert_empty @exchange.exchange_notifications.where(kind: ExchangeNotification::WISHLIST_ACCESS_KINDS)
  end

  private

  def headers_for(participant)
    auth_headers_for(participant.user)
  end

  def wishlist_access_requests_path
    gift_exchange_wishlist_access_requests_path(@exchange)
  end

  def ask(asker, requested)
    post wishlist_access_requests_path, headers: headers_for(asker), params: { participant_id: requested.id }, as: :json
  end

  def answer(participant, access_request_id, decision)
    post send("#{decision}_gift_exchange_wishlist_access_request_path", @exchange, access_request_id),
      headers: headers_for(participant), as: :json
  end

  def show(viewer, participant)
    get gift_exchange_exchange_participant_path(@exchange, participant), headers: headers_for(viewer), as: :json
    assert_response :success
    json_response
  end

  def get_items(viewer, participant)
    get gift_exchange_exchange_participant_exchange_wishlist_items_path(@exchange, participant), headers: headers_for(viewer), as: :json
  end

  def notifications_for(participant)
    get gift_exchange_exchange_notifications_path(@exchange), headers: headers_for(participant), as: :json
    assert_response :success
    json_response
  end
end
