require "test_helper"

class HolidayTest < ActiveSupport::TestCase
  test "requires name" do
    holiday = Holiday.new(date: Date.today)
    assert_not holiday.valid?
    assert_includes holiday.errors[:name], "can't be blank"
  end

  test "has many users through holiday_users" do
    holiday = holidays(:christmas)
    assert_includes holiday.users, users(:one)
    assert_includes holiday.users, users(:two)
  end

  test "has many gifts" do
    holiday = holidays(:christmas)
    assert_includes holiday.gifts, gifts(:sweater)
  end

  test "destroying holiday destroys associated gifts" do
    holiday = holidays(:christmas)
    gift_id = gifts(:sweater).id
    holiday.destroy
    assert_nil Gift.find_by(id: gift_id)
  end

  test "destroying a holiday keeps the record of reminders sent about it" do
    holiday = holidays(:christmas)
    delivery = EmailDelivery.log_sent!(
      user: users(:one), kind: "pending_gifts", subject: "Reminder", dedupe_key: "holiday-test", holiday: holiday
    )

    holiday.destroy!

    assert_nil delivery.reload.holiday_id
  end
end
