require "posthog"

# POSTHOG_API_KEY must come from the environment. There is intentionally no
# hardcoded fallback — a leaked key in a public repo lets anyone send events
# to the analytics project. If unset, instantiate a no-op client so callers
# don't crash but nothing is shipped.
posthog_api_key = ENV.fetch("POSTHOG_API_KEY", "")

POSTHOG =
  if posthog_api_key.empty?
    Class.new do
      def capture(*); end
      def identify(*); end
      def flush; end
      def shutdown; end
    end.new
  else
    PostHog::Client.new({
      api_key: posthog_api_key,
      host: "https://us.i.posthog.com",
      on_error: proc { |status, msg| Rails.logger.error("PostHog error: #{status} - #{msg}") }
    })
  end
