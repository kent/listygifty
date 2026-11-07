require "test_helper"
require "minitest/mock"

class TextMessengerTest < ActiveSupport::TestCase
  TWILIO_ENV = {
    "TWILIO_ACCOUNT_SID" => "AC123",
    "TWILIO_API_KEY_SID" => "SK123",
    "TWILIO_API_KEY_SECRET" => "secret",
    "TWILIO_FROM_NUMBER" => "+12893797875"
  }.freeze

  setup do
    TextMessenger.delivery_method = :twilio
    @saved_env = TWILIO_ENV.keys.index_with { |key| ENV[key] }
    TWILIO_ENV.each { |key, value| ENV[key] = value }
  end

  teardown do
    TextMessenger.delivery_method = :test
    @saved_env.each { |key, value| ENV[key] = value }
  end

  test "posts the message to Twilio from the Listy Gifty number and returns its SID" do
    sent = nil
    fake_post = ->(to:, body:) { sent = { to: to, body: body }; response(Net::HTTPCreated, 201, { sid: "SM1" }) }

    TextMessenger.stub(:post_message, fake_post) do
      assert_equal "SM1", TextMessenger.deliver(to: "+14165550100", body: "Hi")
    end
    assert_equal({ to: "+14165550100", body: "Hi" }, sent)
  end

  test "explains a number that replied STOP" do
    TextMessenger.stub(:post_message, ->(**) { response(Net::HTTPBadRequest, 400, { code: 21610, message: "unsubscribed" }) }) do
      error = assert_raises(TextMessenger::Rejected) { TextMessenger.deliver(to: "+14165550100", body: "Hi") }
      assert_equal 21610, error.code
      assert_match "replied STOP", error.message
    end
  end

  test "treats Twilio outages and network trouble as worth retrying" do
    TextMessenger.stub(:post_message, ->(**) { response(Net::HTTPServiceUnavailable, 503, {}) }) do
      assert_raises(TextMessenger::Unavailable) { TextMessenger.deliver(to: "+14165550100", body: "Hi") }
    end
    TextMessenger.stub(:post_message, ->(**) { raise Net::OpenTimeout }) do
      assert_raises(TextMessenger::Unavailable) { TextMessenger.deliver(to: "+14165550100", body: "Hi") }
    end
  end

  test "isn't configured without every Twilio setting" do
    ENV["TWILIO_API_KEY_SECRET"] = nil
    assert_not TextMessenger.configured?
    assert_raises(TextMessenger::NotConfigured) { TextMessenger.deliver(to: "+14165550100", body: "Hi") }
  end

  private

  def response(klass, code, payload)
    klass.new("1.1", code.to_s, "").tap do |res|
      res.instance_variable_set(:@body, payload.to_json)
      res.instance_variable_set(:@read, true)
    end
  end
end
