require "test_helper"

class RequestBodyLimiterTest < ActiveSupport::TestCase
  test "rejects oversized bodies even when content length is missing or forged" do
    called = false
    app = lambda do |_env|
      called = true
      [ 200, {}, [ "ok" ] ]
    end
    limiter = RequestBodyLimiter.new(app)

    [ "/analytics/events", "/analytics/events.json", "/analytics/events.xml", "/analytics/events/" ].each do |path|
      env = {
        "PATH_INFO" => path,
        "REQUEST_METHOD" => "POST",
        "CONTENT_LENGTH" => "0",
        "rack.input" => StringIO.new("x" * (256.kilobytes + 1))
      }

      status, headers, body = limiter.call(env)

      assert_equal 413, status
      assert_equal "no-store, private", headers["Cache-Control"]
      assert_includes body.join, "too large"
      assert_not called
    end
  end

  test "rewinds an accepted body for downstream JSON parsing" do
    received = nil
    app = lambda do |env|
      received = env.fetch("rack.input").read
      [ 200, {}, [ "ok" ] ]
    end
    limiter = RequestBodyLimiter.new(app)
    env = {
      "PATH_INFO" => "/analytics/events",
      "REQUEST_METHOD" => "POST",
      "rack.input" => StringIO.new('{"events":[]}')
    }

    status, = limiter.call(env)

    assert_equal 200, status
    assert_equal '{"events":[]}', received
  end
end
