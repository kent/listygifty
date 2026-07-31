require "test_helper"

class ExchangeJoinsApiTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    @owner = users(:one)
    @owner_headers = auth_headers_for(@owner)
    @joiner = users(:two)
    @joiner_headers = auth_headers_for(@joiner)
    @exchange = GiftExchange.create!(
      workspace: workspaces(:one),
      user: @owner,
      name: "Share Link Santa",
      status: "inviting"
    )
  end

  teardown do
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
  end

  test "show is public and reports an open exchange" do
    get "/exchange_join/#{@exchange.share_token}", as: :json
    assert_response :success
    assert_equal "Share Link Santa", json_response.dig("exchange", "name")
    assert_equal true, json_response["join_open"]
    assert_nil json_response["closed_reason"]
  end

  test "show reports a closed exchange with a reason" do
    @exchange.update!(status: "active")
    get "/exchange_join/#{@exchange.share_token}", as: :json
    assert_response :success
    assert_equal false, json_response["join_open"]
    assert_match(/already drawn names/, json_response["closed_reason"])
  end

  test "show 404s on an unknown token" do
    get "/exchange_join/not-a-real-token", as: :json
    assert_response :not_found
  end

  test "join requires authentication" do
    post "/exchange_join/#{@exchange.share_token}/join", as: :json
    assert_response :unauthorized
  end

  test "join creates an accepted participant with a custom name" do
    assert_enqueued_emails 2 do
      assert_difference("ExchangeParticipant.count", 1) do
        post "/exchange_join/#{@exchange.share_token}/join",
          headers: @joiner_headers, params: { name: "Cool Uncle" }, as: :json
      end
    end
    assert_response :success

    participant = @exchange.exchange_participants.find_by(user_id: @joiner.id)
    assert_equal "accepted", participant.status
    assert_equal "Cool Uncle", participant.name
    assert_equal @joiner.email, participant.email
    assert json_response.dig("exchange", "my_participant").present?
  end

  test "join is idempotent" do
    post "/exchange_join/#{@exchange.share_token}/join", headers: @joiner_headers, as: :json
    assert_response :success
    clear_enqueued_jobs

    assert_no_enqueued_emails do
      assert_no_difference("ExchangeParticipant.count") do
        post "/exchange_join/#{@exchange.share_token}/join", headers: @joiner_headers, as: :json
      end
    end
    assert_response :success
  end

  test "first join emails the organizer and joiner with exchange links" do
    perform_enqueued_jobs do
      post "/exchange_join/#{@exchange.share_token}/join",
        headers: @joiner_headers, params: { name: "Happy Joiner" }, as: :json
    end

    assert_response :success
    assert_equal 2, ActionMailer::Base.deliveries.size

    organizer_mail = ActionMailer::Base.deliveries.find { |mail| mail.to == [ @owner.email ] }
    joiner_mail = ActionMailer::Base.deliveries.find { |mail| mail.to == [ @joiner.email ] }

    assert organizer_mail
    assert joiner_mail
    assert_includes organizer_mail.subject, "Happy Joiner"
    assert_includes organizer_mail.subject, @exchange.name
    assert_includes joiner_mail.subject, @exchange.name
    assert_includes organizer_mail.body.encoded, "/exchanges/#{@exchange.slug}"
    assert_includes joiner_mail.body.encoded, "/exchanges/#{@exchange.slug}"
  end

  test "join claims a pre-invited participant row with a matching email" do
    invited = @exchange.exchange_participants.create!(
      name: "Pre Invited", email: @joiner.email.upcase, status: "invited"
    )

    assert_enqueued_emails 2 do
      assert_no_difference("ExchangeParticipant.count") do
        post "/exchange_join/#{@exchange.share_token}/join", headers: @joiner_headers, as: :json
      end
    end
    assert_response :success
    invited.reload
    assert_equal "accepted", invited.status
    assert_equal @joiner.id, invited.user_id
  end

  test "join re-accepts a previously declined participant" do
    declined = @exchange.exchange_participants.create!(
      name: "Changed Mind", email: @joiner.email, status: "declined"
    )

    post "/exchange_join/#{@exchange.share_token}/join", headers: @joiner_headers, as: :json
    assert_response :success
    assert_equal "accepted", declined.reload.status
  end

  test "join moves a draft exchange to inviting" do
    @exchange.update!(status: "draft")
    post "/exchange_join/#{@exchange.share_token}/join", headers: @joiner_headers, as: :json
    assert_response :success
    assert_equal "inviting", @exchange.reload.status
  end

  test "join is rejected once the exchange is published" do
    @exchange.update!(status: "active")
    post "/exchange_join/#{@exchange.share_token}/join", headers: @joiner_headers, as: :json
    assert_response :unprocessable_entity
    assert_match(/already drawn names/, json_response["error"])
  end

  test "share_url is only rendered for the owner" do
    @exchange.exchange_participants.create!(
      name: "Joiner", email: @joiner.email, user: @joiner, status: "accepted"
    )

    get "/gift_exchanges/#{@exchange.slug}", headers: @owner_headers, as: :json
    assert_response :success
    assert_includes json_response["share_url"], "/e/#{@exchange.slug}/#{@exchange.share_token}"

    get "/gift_exchanges/#{@exchange.slug}", headers: @joiner_headers, as: :json
    assert_response :success
    assert_nil json_response["share_url"]
  end
end
