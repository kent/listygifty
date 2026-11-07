require "test_helper"
require "minitest/mock"

class ExchangeNudgesTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    ActionMailer::Base.deliveries.clear
    TextMessenger.deliveries.clear
    @organizer = users(:one)
    @exchange = GiftExchange.create!(workspace: workspaces(:one), user: @organizer, name: "Family Secret Santa", status: "inviting")
    @exchange.exchange_participants.create!(user: @organizer, name: "Organizer", email: @organizer.email, status: "accepted")
    @jordan = @exchange.exchange_participants.create!(name: "Jordan", email: "jordan@example.com")
  end

  teardown do
    TextMessenger.deliveries.clear
  end

  test "emails and texts the invite link, and saves the number for next time" do
    perform_enqueued_jobs do
      nudge(@jordan, phone: "(289) 379-7875", text_consent: true)
    end

    assert_response :success
    assert_equal "sent", json_response["text"]
    assert_equal "+12893797875", @jordan.reload.phone
    assert @jordan.text_consent_at.present?
    assert json_response.dig("participant", "text_consent_at").present?
    assert @jordan.last_nudged_at.present?
    assert_not json_response.dig("participant", "can_nudge")

    email = ActionMailer::Base.deliveries.sole
    assert_equal [ "jordan@example.com" ], email.to
    assert_includes email.subject, "still saving you a spot"
    assert_includes email.text_part.body.to_s, "/join/exchange/#{@jordan.invite_token}"

    text = TextMessenger.deliveries.sole
    assert_equal "+12893797875", text[:to]
    assert_includes text[:body], "Family Secret Santa"
    assert_includes text[:body], "/join/exchange/#{@jordan.invite_token}"
    assert_includes text[:body], "Reply STOP to opt out."
  end

  test "doesn't text unless the organizer confirms it's OK" do
    nudge(@jordan, phone: "(289) 379-7875")

    assert_response :success
    assert_equal "skipped", json_response["text"]
    assert_equal "+12893797875", @jordan.reload.phone
    assert_empty TextMessenger.deliveries
  end

  test "remembers that it's OK to text a number, and asks again for a new one" do
    nudge(@jordan, phone: "2893797875", text_consent: true)
    assert_equal 1, TextMessenger.deliveries.size

    travel 25.hours do
      nudge(@jordan)
      assert_equal "sent", json_response["text"]
      assert_equal 2, TextMessenger.deliveries.size
    end

    @jordan.reload.update!(phone: "4165550100")
    assert_nil @jordan.text_consent_at

    travel 50.hours do
      nudge(@jordan)
      assert_equal "skipped", json_response["text"]
      assert_equal 2, TextMessenger.deliveries.size
    end
  end

  test "doesn't text US numbers until there's a US number to text from" do
    nudge(@jordan, phone: "(347) 502-9752", text_consent: true)

    assert_response :success
    assert_equal "failed", json_response["text"]
    assert_equal TextMessenger::US_UNAVAILABLE, json_response["text_error"]
    assert_empty TextMessenger.deliveries
    assert_equal "+13475029752", @jordan.reload.phone
  end

  test "without a number it only emails" do
    assert_enqueued_emails 1 do
      nudge(@jordan)
    end

    assert_response :success
    assert_equal "skipped", json_response["text"]
    assert_empty TextMessenger.deliveries
  end

  test "can fix the email address while nudging" do
    perform_enqueued_jobs do
      nudge(@jordan, email: "jordan.p@example.com")
    end

    assert_response :success
    assert_equal "jordan.p@example.com", @jordan.reload.email
    assert_equal [ [ "jordan.p@example.com" ] ], ActionMailer::Base.deliveries.map(&:to)
  end

  test "each person can be nudged once a day" do
    nudge(@jordan)
    assert_response :success

    assert_no_enqueued_emails do
      nudge(@jordan, phone: "2893797875")
    end
    assert_response :unprocessable_entity
    assert_match "already nudged Jordan today", json_response["error"]
    assert_nil @jordan.reload.phone

    travel 25.hours do
      nudge(@jordan)
      assert_response :success
    end
  end

  test "an organizer can send only so many nudges a day" do
    ExchangeNudgeService::DAILY_LIMIT.times do |index|
      @exchange.exchange_participants.create!(name: "Guest #{index}", email: "guest#{index}@example.com", last_nudged_at: 1.hour.ago)
    end

    nudge(@jordan)

    assert_response :unprocessable_entity
    assert_match "#{ExchangeNudgeService::DAILY_LIMIT} nudges today", json_response["error"]
  end

  test "a wrong number is refused before anything is sent" do
    assert_no_enqueued_emails do
      nudge(@jordan, phone: "12345")
    end

    assert_response :unprocessable_entity
    assert_includes json_response["errors"], "Phone doesn't look like a phone number"
    assert_nil @jordan.reload.last_nudged_at
  end

  test "still emails when Twilio refuses the text, and says why" do
    refuse = ->(**) { raise TextMessenger::Rejected.new(TextMessenger::REJECTION_MESSAGES[21610], code: 21610) }

    TextMessenger.stub(:deliver, refuse) do
      assert_enqueued_emails 1 do
        nudge(@jordan, phone: "2893797875", text_consent: true)
      end
    end

    assert_response :success
    assert_equal "failed", json_response["text"]
    assert_match "replied STOP", json_response["text_error"]
  end

  test "only people who haven't answered can be nudged" do
    @jordan.update!(status: "declined")
    nudge(@jordan)
    assert_response :unprocessable_entity
    assert_match "Invite them again", json_response["error"]

    @jordan.update!(status: "accepted")
    nudge(@jordan)
    assert_response :unprocessable_entity
    assert_match "already joined", json_response["error"]
  end

  test "only the organizer can nudge, and nobody else sees phone numbers" do
    guest = users(:two)
    @exchange.exchange_participants.create!(user: guest, name: "Guest", email: guest.email, status: "accepted")
    @jordan.update!(phone: "2893797875")

    nudge(@jordan, as: guest)
    assert_response :forbidden

    get gift_exchange_exchange_participants_path(@exchange), headers: auth_headers_for(guest), as: :json
    assert_response :success
    assert json_response.none? { |participant| participant.key?("phone") }
  end

  test "can't nudge once names are drawn" do
    @exchange.update_columns(status: "active")

    nudge(@jordan)

    assert_response :unprocessable_entity
    assert_empty TextMessenger.deliveries
  end

  private

  def nudge(participant, as: @organizer, **details)
    body = details.empty? ? {} : { exchange_participant: details }
    post nudge_gift_exchange_exchange_participant_path(@exchange, participant),
      params: body, headers: auth_headers_for(as), as: :json
  end
end
