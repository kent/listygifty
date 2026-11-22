require "test_helper"

class RequestBodyLimiterTest < ActiveSupport::TestCase
  test "runs after Rack Attack and before controller parameter parsing" do
    classes = Rails.application.middleware.map(&:klass)
    assert_operator classes.index(ActionDispatch::RemoteIp), :<, classes.index(Rack::Attack)
    assert_equal classes.index(Rack::Attack) + 1, classes.index(RequestBodyLimiter)
  end

  test "rejects oversized bodies even when content length is missing or forged" do
    called = false
    app = lambda do |_env|
      called = true
      [ 200, {}, [ "ok" ] ]
    end
    limiter = RequestBodyLimiter.new(app)

    {
      "/analytics/events" => 256.kilobytes,
      "/analytics/events.json" => 256.kilobytes,
      "/admin/mcp.xml" => 256.kilobytes,
      "/mcp" => RequestBodyLimiter::PHOTO_BODY_LIMIT,
      "/apps/mcp" => RequestBodyLimiter::PHOTO_BODY_LIMIT,
      "/oauth/register" => 256.kilobytes,
      "/oauth/authorize/consent.xml" => 256.kilobytes
    }.each do |path, limit|
      env = {
        "PATH_INFO" => path,
        "REQUEST_METHOD" => "POST",
        "CONTENT_LENGTH" => "0",
        "rack.input" => StringIO.new("x" * (limit + 1))
      }

      status, headers, body = limiter.call(env)

      assert_equal 413, status
      assert_equal "no-store, private", headers["Cache-Control"]
      assert_includes body.join, "too large"
      assert_not called
    end
  end

  test "MCP takes photo-sized bodies up to Cloud Run's 32 MiB HTTP/1 ceiling" do
    limiter = RequestBodyLimiter.new(->(_env) { [ 200, {}, [ "ok" ] ] })
    photo = Base64.strict_encode64("x" * (20 * 1024 * 1024))
    body = { jsonrpc: "2.0", method: "tools/call", id: 1,
             params: { name: "create_gift", arguments: { holiday_id: 1, name: "Boots", photo: { data: photo } } } }.to_json

    assert_equal 32 * 1024 * 1024, RequestBodyLimiter::PHOTO_BODY_LIMIT
    %w[/mcp /apps/mcp].each do |path|
      env = { "PATH_INFO" => path, "REQUEST_METHOD" => "POST", "rack.input" => StringIO.new(body) }
      assert_equal 200, limiter.call(env).first, path
    end
  end

  test "bounds every mutation content type before Rails parameter parsing" do
    called = false
    limiter = RequestBodyLimiter.new(lambda do |_env|
      called = true
      [ 200, {}, [ "ok" ] ]
    end)

    %w[POST PUT PATCH DELETE].each do |method|
      env = {
        "PATH_INFO" => "/people/123",
        "REQUEST_METHOD" => method,
        "CONTENT_TYPE" => method == "PATCH" ? "application/x-www-form-urlencoded" : "application/vnd.api+json; charset=utf-8",
        "CONTENT_LENGTH" => "0",
        "rack.input" => StringIO.new("x" * (RequestBodyLimiter::DEFAULT_MUTATION_LIMIT + 1))
      }
      status, _headers, body = limiter.call(env)
      assert_equal 413, status
      assert_includes body.join, "Request body is too large"
      assert_not called
    end
  end

  test "bounds multipart import request bodies before Rails parses them" do
    called = false
    limiter = RequestBodyLimiter.new(lambda do |_env|
      called = true
      [ 200, {}, [ "ok" ] ]
    end)

    %w[/imports/people /imports/gifts.csv].each do |path|
      env = {
        "PATH_INFO" => path,
        "REQUEST_METHOD" => "POST",
        "CONTENT_LENGTH" => "0",
        "rack.input" => StringIO.new("x" * (CsvImportLimits::MAX_FILE_BYTES + 1))
      }
      status, _headers, body = limiter.call(env)
      assert_equal 413, status
      assert_includes body.join, "CSV import is too large"
      assert_not called
    end
  end

  test "allows bounded exchange photos but rejects oversized multipart bodies" do
    calls = 0
    limiter = RequestBodyLimiter.new(lambda do |_env|
      calls += 1
      [ 200, {}, [ "ok" ] ]
    end)
    path = "/gift_exchanges/1/exchange_participants/2/exchange_wishlist_items/3"
    accepted = {
      "PATH_INFO" => path,
      "REQUEST_METHOD" => "PATCH",
      "CONTENT_TYPE" => "multipart/form-data; boundary=test",
      "CONTENT_LENGTH" => "0",
      "rack.input" => StringIO.new("x" * (RequestBodyLimiter::DEFAULT_MUTATION_LIMIT + 1))
    }
    assert_equal 200, limiter.call(accepted).first
    assert_equal 1, calls

    oversized_json = accepted.merge(
      "CONTENT_TYPE" => "application/json",
      "rack.input" => StringIO.new("x" * (RequestBodyLimiter::DEFAULT_MUTATION_LIMIT + 1))
    )
    assert_equal 413, limiter.call(oversized_json).first
    assert_equal 1, calls

    oversized = accepted.merge(
      "rack.input" => StringIO.new("x" * (RequestBodyLimiter::PHOTO_BODY_LIMIT + 1))
    )
    status, = limiter.call(oversized)
    assert_equal 413, status
    assert_equal 1, calls
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
