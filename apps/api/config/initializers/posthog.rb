require "posthog-ruby"

POSTHOG = PostHog::Client.new({
  api_key: ENV.fetch("POSTHOG_API_KEY", "REDACTED_POSTHOG_KEY_ROTATED_2026_05"),
  host: "https://us.i.posthog.com",
  on_error: proc { |status, msg| Rails.logger.error("PostHog error: #{status} - #{msg}") }
})
