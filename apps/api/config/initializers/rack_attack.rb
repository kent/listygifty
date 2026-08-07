class Rack::Attack
  # Disable throttling in development/test
  Rack::Attack.enabled = Rails.env.production?

  safelist("health checks") do |req|
    req.path == "/up"
  end

  # Throttle all requests by IP (60 requests per minute)
  throttle("req/ip", limit: 60, period: 1.minute) do |req|
    req.ip unless req.path.start_with?("/assets")
  end

  # Throttle OAuth credential exchange and dynamic client registration.
  throttle("oauth/ip", limit: 20, period: 1.minute) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/oauth/(token|register|revoke)\z})
  end

  # Throttle billing endpoints (10 per minute per IP)
  throttle("billing/ip", limit: 10, period: 1.minute) do |req|
    req.ip if req.path.start_with?("/billing") && req.post?
  end

  # Analytics clients send small batches and may flush during rapid route
  # changes; keep this above the ordinary product-request baseline.
  throttle("analytics/ip", limit: 120, period: 1.minute) do |req|
    req.ip if req.post? && req.path == "/analytics/events"
  end

  throttle("admin_mcp/ip", limit: 30, period: 1.minute) do |req|
    req.ip if req.post? && req.path == "/admin/mcp"
  end

  throttle("admin_mcp/credential", limit: 60, period: 1.minute) do |req|
    next unless req.post? && req.path == "/admin/mcp"

    authorization = req.get_header("HTTP_AUTHORIZATION")
    Digest::SHA256.hexdigest(authorization) if authorization&.match?(/\ABearer ng_[A-Za-z0-9_-]{43}\z/)
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
