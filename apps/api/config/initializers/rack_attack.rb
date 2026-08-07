class Rack::Attack
  # Disable throttling in development/test
  Rack::Attack.enabled = Rails.env.production?

  safelist("health checks") do |req|
    req.path == "/up"
  end

  # Throttle all requests by IP (60 requests per minute)
  throttle("req/ip", limit: 60, period: 1.minute) do |req|
    dedicated_limit = RequestBodyLimiter::ANALYTICS_PATH.match?(req.path) || RequestBodyLimiter::ADMIN_PATH.match?(req.path)
    req.ip unless req.path.start_with?("/assets") || dedicated_limit
  end

  # Dynamic registration is anonymous and persistent, so constrain it much
  # more tightly than short-lived authorization/token traffic.
  throttle("oauth_registration/ip", limit: 10, period: 1.hour) do |req|
    req.ip if req.post? && RequestBodyLimiter::OAUTH_REGISTRATION_PATH.match?(req.path)
  end

  throttle("oauth/ip", limit: 20, period: 1.minute) do |req|
    req.ip if RequestBodyLimiter::OAUTH_PATH.match?(req.path) &&
      !RequestBodyLimiter::OAUTH_REGISTRATION_PATH.match?(req.path)
  end

  # Throttle billing endpoints (10 per minute per IP)
  throttle("billing/ip", limit: 10, period: 1.minute) do |req|
    req.ip if req.path.start_with?("/billing") && req.post?
  end

  throttle("exchange_photos/ip", limit: 20, period: 1.hour) do |req|
    multipart = req.media_type.to_s.start_with?("multipart/form-data")
    req.ip if req.patch? && multipart && RequestBodyLimiter::EXCHANGE_PHOTO_PATH.match?(req.path)
  end

  throttle("imports/ip", limit: 5, period: 1.hour) do |req|
    req.ip if req.post? && RequestBodyLimiter::IMPORT_PATH.match?(req.path)
  end

  # Analytics clients send small batches and may flush during rapid route
  # changes; keep this above the ordinary product-request baseline.
  throttle("analytics/ip", limit: 120, period: 1.minute) do |req|
    req.ip if req.post? && RequestBodyLimiter::ANALYTICS_PATH.match?(req.path)
  end

  throttle("admin_mcp/ip", limit: 30, period: 1.minute) do |req|
    req.ip if RequestBodyLimiter::ADMIN_PATH.match?(req.path)
  end

  throttle("admin_mcp/credential", limit: 60, period: 1.minute) do |req|
    next unless RequestBodyLimiter::ADMIN_PATH.match?(req.path)

    raw_token = BearerTokenExtractor.extract(req.get_header("HTTP_AUTHORIZATION"))
    Digest::SHA256.hexdigest(raw_token) if raw_token
  end

  # Token-based public links are intentionally unauthenticated; keep guessing
  # and scraping pressure lower than the authenticated API baseline.
  throttle("public_token_links/ip", limit: 30, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{\A/(w|claim|workspace_invite|exchange_invite|email_preferences)/})
  end

  # Throttle gift suggestion generation (5 per minute per IP - AI calls are expensive)
  throttle("gift_suggestions/ip", limit: 5, period: 1.minute) do |req|
    req.ip if req.path.include?("/gift_suggestions") && req.post?
  end

  # Block suspicious requests - ban after repeated failures
  blocklist("block bad IPs") do |req|
    Rack::Attack::Allow2Ban.filter(req.ip, maxretry: 20, findtime: 1.minute, bantime: 1.hour) do
      # Track 4xx responses (handled via Rack::Attack.track)
      false
    end
  end

  # Custom response for throttled requests
  self.throttled_responder = lambda do |env|
    retry_after = (env["rack.attack.match_data"] || {})[:period]
    [
      429,
      { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s },
      [ { error: "Rate limit exceeded. Retry later." }.to_json ]
    ]
  end
end
