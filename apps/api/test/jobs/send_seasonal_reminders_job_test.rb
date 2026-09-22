require "test_helper"

class SendSeasonalRemindersJobTest < ActiveSupport::TestCase
  setup do
    travel_to Time.zone.local(2026, 12, 10, 9)
    @user = User.create!(email: "seasonal@example.com", clerk_user_id: "seasonal_user")
    @workspace = @user.ensure_personal_workspace!
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "a Christmas list without a date uses December 25 for the countdown" do
    create_holiday(date: nil)
    SendSeasonalRemindersJob.perform_now
    assert_equal 1, recipient_messages.length
    assert_includes recipient_messages.first.subject, "15 days until Christmas"
    assert_equal 1, @user.email_deliveries.sent.count
  end

  [ Date.new(2025, 12, 25), Date.new(2027, 12, 25), Date.new(2026, 12, 1) ].each do |date|
    test "a Christmas list dated #{date} does not produce an irrelevant countdown" do
      create_holiday(date: date)
      SendSeasonalRemindersJob.perform_now
      assert_empty recipient_messages
    end
  end

  test "December list reminders do not show a negative countdown after Christmas" do
    travel_to Time.zone.local(2026, 12, 28, 9)
    SendSeasonalRemindersJob.perform_now
    assert_equal 1, recipient_messages.length
    assert_no_match(/-3\s+days until Christmas/, recipient_messages.first.text_part.body.decoded)
  end

  test "a renamed final status is complete for both reminders and bootstrap" do
    holiday = create_holiday(date: Date.new(2026, 12, 25))
    status = gift_statuses(:done)
    status.update!(name: "All finished")
    holiday.gifts.create!(name: "Ready gift", gift_status: status)
    SendSeasonalRemindersJob.perform_now
    assert_empty recipient_messages
    assert_equal 0, BootstrapPayloadService.new(user: @user).call[:data][:pending_gift_total]
  end

  test "reruns respect the delivery cadence" do
    create_holiday(date: Date.new(2026, 12, 25))
    2.times { SendSeasonalRemindersJob.perform_now }
    assert_equal 1, recipient_messages.length
  end

  private

  def create_holiday(date:)
    holiday = @workspace.holidays.create!(name: "Christmas gifts", date: date)
    holiday.holiday_users.create!(user: @user, role: "owner")
    holiday
  end

  def recipient_messages
    ActionMailer::Base.deliveries.select { |mail| mail.to.include?(@user.email) }
  end
end
