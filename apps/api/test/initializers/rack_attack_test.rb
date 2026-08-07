require "test_helper"

class RackAttackTest < ActiveSupport::TestCase
  test "dynamic registration has a distinct lower persistent-write throttle" do
    registration = Rack::Attack.throttles.fetch("oauth_registration/ip")
    oauth = Rack::Attack.throttles.fetch("oauth/ip")
    register_requests = %w[/oauth/register /oauth/register/ /oauth/register.json].map do |path|
      rack_attack_request(path)
    end
    token_request = rack_attack_request("/oauth/token")

    assert_equal 10, registration.limit
    assert_equal 1.hour, registration.period
    register_requests.each do |register_request|
      assert_equal "192.0.2.1", registration.instance_variable_get(:@block).call(register_request)
      assert_nil oauth.instance_variable_get(:@block).call(register_request)
    end
    assert_nil registration.instance_variable_get(:@block).call(token_request)
    assert_equal "192.0.2.1", oauth.instance_variable_get(:@block).call(token_request)
  end

  test "exchange photo uploads have a dedicated low persistent-write throttle" do
    throttle = Rack::Attack.throttles.fetch("exchange_photos/ip")
    request = rack_attack_request(
      "/gift_exchanges/1/exchange_participants/2/exchange_wishlist_items/3",
      method: "PATCH",
      content_type: "multipart/form-data; boundary=test"
    )
    assert_equal 20, throttle.limit
    assert_equal 1.hour, throttle.period
    assert_equal "192.0.2.1", throttle.instance_variable_get(:@block).call(request)
    assert_nil throttle.instance_variable_get(:@block).call(rack_attack_request(request.path))
  end

  test "imports have a dedicated low persistent-write throttle" do
    throttle = Rack::Attack.throttles.fetch("imports/ip")
    assert_equal 5, throttle.limit
    assert_equal 1.hour, throttle.period
    %w[/imports/people /imports/gifts/ /imports/people.csv].each do |path|
      assert_equal "192.0.2.1", throttle.instance_variable_get(:@block).call(rack_attack_request(path))
    end
  end

  private

  def rack_attack_request(path, method: "POST", content_type: nil)
    env = Rack::MockRequest.env_for(path, method: method)
    env["CONTENT_TYPE"] = content_type if content_type
    env["REMOTE_ADDR"] = "192.0.2.1"
    Rack::Attack::Request.new(env)
  end
end
