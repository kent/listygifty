require "test_helper"

class PhoneNumberTest < ActiveSupport::TestCase
  test "reads North American numbers however they're typed" do
    [ "(289) 379-7875", "289.379.7875", "2893797875", "1-289-379-7875", "+1 289 379 7875" ].each do |typed|
      assert_equal "+12893797875", PhoneNumber.normalize(typed), typed
    end
  end

  test "keeps international numbers that start with a plus" do
    assert_equal "+447911123456", PhoneNumber.normalize("+44 7911 123456")
  end

  test "blank is nil and nonsense is left for validation to catch" do
    assert_nil PhoneNumber.normalize("  ")
    assert_equal "12345", PhoneNumber.normalize("12345")
    assert_equal "call me", PhoneNumber.normalize("call me")
  end

  test "a participant's phone is stored in E.164 and checked" do
    exchange = GiftExchange.create!(workspace: workspaces(:one), user: users(:one), name: "Phones")
    participant = exchange.exchange_participants.create!(name: "Jordan", email: "jordan@example.com", phone: "(289) 379-7875")
    assert_equal "+12893797875", participant.phone

    participant.phone = "12345"
    assert_not participant.valid?
    assert_includes participant.errors[:phone], "doesn't look like a phone number"

    participant.phone = ""
    assert participant.valid?
    assert_nil participant.phone
  end

  test "tells US numbers from Canadian ones" do
    assert PhoneNumber.us?("+13475029752")
    assert PhoneNumber.us?("+12125550100")
    assert_not PhoneNumber.us?("+14167881373")
    assert_not PhoneNumber.us?("+12893797875")
    assert_not PhoneNumber.us?("+447700900123")
    assert_not PhoneNumber.us?(nil)
  end
end
