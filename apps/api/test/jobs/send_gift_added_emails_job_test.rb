require "test_helper"

class SendGiftAddedEmailsJobTest < ActiveSupport::TestCase
  setup do
    travel_to Time.zone.local(2026, 11, 10, 12)
    @holiday = holidays(:christmas)
    @owner = users(:one)
    @collaborator = users(:two)
    @owner.update!(first_name: "Riley")
    HolidayUser.where(holiday: @holiday).update_all(gifts_notified_at: 1.hour.ago)
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "emails the other members once the adds settle, and never twice" do
    add_gift("Wool socks", by: @owner, recipients: [ people(:mom) ])

    travel 4.minutes
    SendGiftAddedEmailsJob.perform_now
    assert_empty ActionMailer::Base.deliveries, "still inside the quiet period"

    travel 2.minutes
    SendGiftAddedEmailsJob.perform_now
    mail = ActionMailer::Base.deliveries.sole
    assert_equal [ @collaborator.email ], mail.to
    assert_equal "🎁 New gift added to Christmas 2025", mail.subject
    [ mail.text_part.decoded, mail.html_part.decoded ].each do |body|
      assert_includes body, "Wool socks for #{people(:mom).name}"
      assert_includes body, "Riley"
      assert_includes body, "/holidays/#{@holiday.id}"
    end
    assert_equal "gift_added", @collaborator.email_deliveries.sent.sole.kind

    travel 10.minutes
    SendGiftAddedEmailsJob.perform_now
    assert_equal 1, ActionMailer::Base.deliveries.length
  end

  test "a burst of adds arrives as one email" do
    %w[Socks Scarf Mittens].each do |name|
      add_gift(name, by: @owner)
      travel 1.minute
    end

    travel 5.minutes
    SendGiftAddedEmailsJob.perform_now

    assert_equal "🎁 3 new gifts added to Christmas 2025", ActionMailer::Base.deliveries.sole.subject
  end

  test "someone adding gifts nonstop still gets an email out within half an hour" do
    35.times do |i|
      add_gift("Gift #{i}", by: @owner)
      travel 1.minute
      SendGiftAddedEmailsJob.perform_now if (i % 5).zero?
    end

    assert_equal 1, ActionMailer::Base.deliveries.length
  end

  test "doesn't email people about their own gifts" do
    add_gift("Wool socks", by: @collaborator)

    travel 10.minutes
    SendGiftAddedEmailsJob.perform_now

    assert_equal [ @owner.email ], ActionMailer::Base.deliveries.sole.to
  end

  test "members who chose the daily summary or off get no email" do
    HolidayUser.find_by!(holiday: @holiday, user: @collaborator).update!(gift_notifications: "daily")
    add_gift("Wool socks", by: @owner)
    other_list = Holiday.create!(name: "Birthdays", workspace: @holiday.workspace)
    other_list.holiday_users.create!(user: @owner, role: "owner", gifts_notified_at: 1.hour.ago)
    other_list.holiday_users.create!(user: @collaborator, gift_notifications: "off", gifts_notified_at: 1.hour.ago)
    add_gift("Candle", by: @owner, holiday: other_list)

    travel 10.minutes
    SendGiftAddedEmailsJob.perform_now

    assert_empty ActionMailer::Base.deliveries
  end

  test "skips archived lists" do
    @holiday.update!(archived: true)
    add_gift("Wool socks", by: @owner)

    travel 10.minutes
    SendGiftAddedEmailsJob.perform_now

    assert_empty ActionMailer::Base.deliveries
  end

  private

  def add_gift(name, by:, holiday: @holiday, recipients: [])
    Current.set(user: by) do
      gift = Gift.create!(name: name, holiday: holiday, gift_status: gift_statuses(:idea))
      recipients.each { |person| gift.gift_recipients.create!(person: person) }
      gift
    end
  end
end
