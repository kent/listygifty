require "uri"

module Analytics
  class Sanitizer
    SENSITIVE_PATH_PATTERNS = [
      [ %r{\A/claim/[^/]+(?:/.*)?\z}, "/claim/:token" ],
      [ %r{\A/email-preferences/[^/]+(?:/.*)?\z}, "/email-preferences/:token" ],
      [ %r{\A/email_preferences/[^/]+(?:/.*)?\z}, "/email_preferences/:token" ],
      [ %r{\A/join/(?:exchange|workspace)/[^/]+/?\z}, "/join/:kind/:token" ],
      [ %r{\A/join/x/[^/]+/?\z}, "/join/x/:share_token" ],
      [ %r{\A/join/[^/]+/?\z}, "/join/:token" ],
      [ %r{\A/w/[^/]+(?:/.*)?\z}, "/w/:token" ],
      [ %r{\A/e/[^/]+/[^/]+/?\z}, "/e/:slug/:share_token" ],
      [ %r{\A/(?:workspace_invite|exchange_invite)/[^/]+(?:/.*)?\z}, "/:invite_type/:token" ],
      [ %r{\A/exchange_join/[^/]+(?:/.*)?\z}, "/exchange_join/:share_token" ]
    ].freeze
    RESERVED_PROPERTY_KEYS = %w[user_id workspace_id email token anonymous_id session_id].freeze
    SAFE_AGGREGATE_KEYS = %w[has_email addresses_created addresses_skipped].freeze
    SENSITIVE_PROPERTY_KEY = /(?:email|phone|address|password|secret|token|digest|api_key|access_key|private_key)\z/i
    EMAIL_VALUE = /[^\s@]+@[^\s@]+\.[^\s@]+/
    URL_VALUE = %r{https?://}i

    class << self
      def path(value)
        raw = value.to_s.split(/[?#]/, 2).first.to_s.first(1_000)
        return nil if raw.blank?

        pattern = SENSITIVE_PATH_PATTERNS.find { |candidate, _template| candidate.match?(raw) }
        pattern ? pattern.last : raw
      end

      def url(value)
        raw = value.to_s.first(2_000)
        return nil if raw.blank?

        parsed = URI.parse(raw)
        return path(raw) if raw.start_with?("/")
        return nil unless parsed.is_a?(URI::HTTP) && parsed.host.present?

        default_port = (parsed.scheme == "https" ? 443 : 80)
        port = parsed.port == default_port ? nil : ":#{parsed.port}"
        sanitized_path = path(parsed.path.presence || "/")
        "#{parsed.scheme.downcase}://#{parsed.host.downcase}#{port}#{sanitized_path}"
      rescue URI::InvalidURIError
        path(raw)
      end

      def properties(value)
        return {} unless value.is_a?(Hash)

        value.each_with_object({}) do |(raw_key, raw_value), sanitized|
          key = raw_key.to_s.first(100)
          next if sensitive_property_key?(key)

          scalar = case key
          when "path", "landing_page" then path(raw_value)
          when "referrer" then url(raw_value)
          when "title" then :drop
          else sanitized_scalar(raw_value)
          end
          sanitized[key] = scalar unless scalar == :drop
        end
      end

      private

      def sensitive_property_key?(key)
        return false if SAFE_AGGREGATE_KEYS.include?(key)

        RESERVED_PROPERTY_KEYS.include?(key) || key.match?(SENSITIVE_PROPERTY_KEY)
      end

      def sanitized_scalar(value)
        case value
        when String
          text = value.first(1_000)
          return :drop if text.match?(EMAIL_VALUE) || text.match?(URL_VALUE)

          text
        when Numeric, TrueClass, FalseClass, NilClass
          value
        else
          :drop
        end
      end
    end
  end
end
