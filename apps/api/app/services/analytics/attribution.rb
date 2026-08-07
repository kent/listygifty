require "uri"

module Analytics
  class Attribution
    CLICK_ID_KEYS = %w[gclid gbraid wbraid fbclid msclkid ttclid].freeze
    UTM_KEYS = %w[utm_source utm_medium utm_campaign utm_term utm_content].freeze
    SEARCH_HOSTS = %w[google. bing. yahoo. duckduckgo. ecosia.].freeze
    SOCIAL_HOSTS = %w[facebook. instagram. linkedin. t.co twitter. x.com tiktok. pinterest. reddit.].freeze
    FIRST_PARTY_HOSTS = %w[listygifty.com localhost 127.0.0.1].freeze
    CANONICAL_DIMENSION_KEYS = %w[utm_source utm_medium utm_campaign].freeze

    def self.normalize(raw, referrer: nil)
      values = raw.to_h.stringify_keys.slice(*(UTM_KEYS + CLICK_ID_KEYS)).each_with_object({}) do |(key, value), normalized|
        value = value.to_s.strip.first(500).presence
        normalized[key] = CANONICAL_DIMENSION_KEYS.include?(key) ? value&.downcase : value if value
      end
      values["referrer_host"] = referrer_host(referrer)
      values["channel"] = classify(values)
      values
    end

    def self.classify(values)
      source = values["utm_source"].to_s.downcase
      medium = values["utm_medium"].to_s.downcase
      host = values["referrer_host"].to_s.downcase

      return "paid_search" if values.keys.intersect?(%w[gclid gbraid wbraid msclkid]) || medium.match?(/\A(cpc|ppc|paid_search|sem)\z/)
      return "paid_social" if values["fbclid"].present? || values["ttclid"].present? || medium.match?(/paid.*social|social.*paid/)
      return "email" if medium.match?(/email|newsletter/) || source.match?(/mailchimp|convertkit|beehiiv/)
      return "affiliate" if medium.match?(/affiliate|partner|influencer/)
      return "display" if medium.match?(/display|banner|cpm|programmatic/)
      return "organic_search" if SEARCH_HOSTS.any? { |needle| host.include?(needle) }
      return "organic_social" if medium == "social" || SOCIAL_HOSTS.any? { |needle| host.include?(needle) }
      return "referral" if host.present?
      return "direct" if source.blank? && medium.blank?

      "other"
    end

    def self.referrer_host(referrer)
      return nil if referrer.blank?

      host = URI.parse(referrer).host&.downcase
      return nil if host.blank? || FIRST_PARTY_HOSTS.any? { |domain| host == domain || host.end_with?(".#{domain}") }

      host
    rescue URI::InvalidURIError
      nil
    end
  end
end
