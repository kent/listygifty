module Analytics
  class Ingestor
    MAX_BATCH_SIZE = 50
    MAX_PROPERTIES = 50
    MAX_PROPERTIES_BYTES = 8.kilobytes
    ID_FORMAT = /\A[A-Za-z0-9_-]{16,100}\z/
    RESERVED_PROPERTIES = %w[user_id workspace_id email token anonymous_id session_id].freeze
    SENSITIVE_PROPERTY_PATTERN = /(email|phone|address|password|secret|token|user_id|workspace_id|anonymous_id|session_id)/i

    def initialize(user:, workspace:, ip:, user_agent:)
      @user = user
      @workspace = workspace
      @ip = ip
      @user_agent = user_agent.to_s.first(500)
    end

    def call(events)
      validate_batch!(events)
      accepted = 0
      duplicates = 0

      AnalyticsEvent.transaction do
        events.each do |raw_event|
          payload = event_hash(raw_event).stringify_keys
          if AnalyticsEvent.exists?(event_id: payload.fetch("event_id"))
            duplicates += 1
            next
          end

          begin
            AnalyticsEvent.transaction(requires_new: true) { ingest!(payload) }
            accepted += 1
          rescue ActiveRecord::RecordNotUnique
            duplicates += 1
          end
        end
      end

      { accepted: accepted, duplicates: duplicates, rejected: 0 }
    end

    private

    def validate_batch!(events)
      raise ArgumentError, "events must be an array" unless events.is_a?(Array)
      raise ArgumentError, "events must contain between 1 and #{MAX_BATCH_SIZE} entries" unless events.length.between?(1, MAX_BATCH_SIZE)

      events.each do |event|
        payload = event_hash(event).stringify_keys
        raise ArgumentError, "event_id is invalid" unless payload["event_id"].to_s.match?(ID_FORMAT)
        raise ArgumentError, "anonymous_id is invalid" unless payload["anonymous_id"].to_s.match?(ID_FORMAT)
        raise ArgumentError, "session_id is invalid" unless payload["session_id"].to_s.match?(ID_FORMAT)
        raise ArgumentError, "event_name is invalid" unless payload["event_name"].to_s.match?(/\A[a-z][a-z0-9_]{0,79}\z/)
        validate_properties!(payload["properties"] || {})
      end
    end

    def event_hash(event)
      return event if event.is_a?(Hash)
      return event.to_unsafe_h if event.respond_to?(:to_unsafe_h)

      raise ArgumentError, "each event must be an object"
    end

    def validate_properties!(properties)
      raise ArgumentError, "properties must be an object" unless properties.is_a?(Hash)
      raise ArgumentError, "properties may contain at most #{MAX_PROPERTIES} keys" if properties.length > MAX_PROPERTIES
      raise ArgumentError, "properties exceed #{MAX_PROPERTIES_BYTES} bytes" if properties.to_json.bytesize > MAX_PROPERTIES_BYTES
    end

    def ingest!(payload)
      occurred_at = normalized_time(payload["occurred_at"])
      referrer = sanitize_url(payload["referrer"])
      attribution = Attribution.normalize(payload["attribution"], referrer: referrer)
      visitor = find_or_update_visitor!(payload, occurred_at, attribution, referrer)
      associate_user!(visitor, payload)

      AnalyticsEvent.create!(
        event_id: payload.fetch("event_id"),
        event_name: payload.fetch("event_name"),
        occurred_at: occurred_at,
        received_at: Time.current,
        analytics_visitor: visitor,
        user: @user,
        workspace: @workspace,
        anonymous_id: payload.fetch("anonymous_id"),
        session_id: payload.fetch("session_id"),
        platform: normalized_platform(payload["platform"]),
        path: sanitize_path(payload["path"]),
        title: payload["title"].to_s.first(500).presence,
        referrer: referrer,
        landing_page: sanitize_path(payload["landing_page"]),
        channel: attribution.fetch("channel"),
        utm_source: attribution["utm_source"],
        utm_medium: attribution["utm_medium"],
        utm_campaign: attribution["utm_campaign"],
        utm_term: attribution["utm_term"],
        utm_content: attribution["utm_content"],
        click_ids: attribution.slice(*Attribution::CLICK_ID_KEYS),
        properties: sanitized_properties(payload["properties"] || {}),
        ip_hash: ip_hash,
        user_agent: @user_agent
      )
    end

    def find_or_update_visitor!(payload, occurred_at, attribution, referrer)
      landing_page = sanitize_path(payload["landing_page"] || payload["path"])
      visitor = AnalyticsVisitor.find_by(anonymous_id: payload.fetch("anonymous_id"))
      unless visitor
        now = Time.current
        AnalyticsVisitor.insert_all([ {
          anonymous_id: payload.fetch("anonymous_id"),
          first_seen_at: occurred_at,
          last_seen_at: occurred_at,
          first_landing_page: landing_page,
          last_landing_page: landing_page,
          first_referrer: referrer,
          last_referrer: referrer,
          first_channel: attribution.fetch("channel"),
          last_channel: attribution.fetch("channel"),
          first_touch: attribution.except("channel"),
          last_touch: attribution.except("channel"),
          created_at: now,
          updated_at: now
        } ], unique_by: :anonymous_id)
        visitor = AnalyticsVisitor.find_by!(anonymous_id: payload.fetch("anonymous_id"))
      end

      visitor.with_lock do
        if occurred_at < visitor.first_seen_at
          visitor.first_seen_at = occurred_at
          visitor.first_landing_page = landing_page
          visitor.first_referrer = referrer
          visitor.first_channel = attribution.fetch("channel")
          visitor.first_touch = attribution.except("channel")
        end
        if occurred_at >= visitor.last_seen_at
          visitor.last_seen_at = occurred_at
          visitor.last_landing_page = landing_page if landing_page.present?
          visitor.last_referrer = referrer if referrer.present?
          if attribution.fetch("channel") != "direct" || visitor.last_touch.blank?
            visitor.last_channel = attribution.fetch("channel")
            visitor.last_touch = attribution.except("channel")
          end
        end
        visitor.save! if visitor.changed?
      end
      visitor
    end

    def associate_user!(visitor, payload)
      return unless @user

      newly_associated = visitor.user_id != @user.id
      visitor.update!(user: @user) if newly_associated
      AnalyticsEvent.where(anonymous_id: visitor.anonymous_id, user_id: nil).update_all(user_id: @user.id, updated_at: Time.current) if newly_associated
      synthesize_signup!(visitor, payload) if @user.created_at >= 24.hours.ago
    end

    def synthesize_signup!(visitor, payload)
      return if AnalyticsEvent.exists?(analytics_visitor: visitor, user: @user, event_name: "user_signed_up")

      AnalyticsEvent.create_or_find_by!(event_id: "signup_#{visitor.id}_#{@user.id}") do |event|
        event.assign_attributes(
          event_name: "user_signed_up",
          occurred_at: @user.created_at,
          received_at: Time.current,
          analytics_visitor: visitor,
          user: @user,
          workspace: @workspace,
          anonymous_id: visitor.anonymous_id,
          session_id: payload.fetch("session_id"),
          platform: normalized_platform(payload["platform"]),
          path: sanitize_path(payload["path"]),
          landing_page: visitor.first_landing_page,
          channel: visitor.first_channel,
          utm_source: visitor.first_touch["utm_source"],
          utm_medium: visitor.first_touch["utm_medium"],
          utm_campaign: visitor.first_touch["utm_campaign"],
          utm_term: visitor.first_touch["utm_term"],
          utm_content: visitor.first_touch["utm_content"],
          click_ids: visitor.first_touch.slice(*Attribution::CLICK_ID_KEYS),
          properties: {},
          ip_hash: ip_hash,
          user_agent: @user_agent
        )
      end
    end

    def normalized_time(value)
      parsed = Time.iso8601(value.to_s)
      return Time.current if parsed < 24.hours.ago || parsed > 5.minutes.from_now

      parsed
    rescue ArgumentError
      Time.current
    end

    def normalized_platform(value)
      value = value.to_s.downcase
      AnalyticsEvent::PLATFORMS.include?(value) ? value : "unknown"
    end

    def sanitize_path(value)
      value.to_s.split("?", 2).first.to_s.first(1_000).presence
    end

    def sanitize_url(value)
      value.to_s.split("?", 2).first.to_s.first(1_000).presence
    end

    def sanitized_properties(properties)
      properties.stringify_keys.reject { |key, _value| RESERVED_PROPERTIES.include?(key) || key.match?(SENSITIVE_PROPERTY_PATTERN) }.transform_values do |value|
        case value
        when String then value.first(1_000)
        when Numeric, TrueClass, FalseClass, NilClass then value
        else value.to_s.first(1_000)
        end
      end
    end

    def ip_hash
      return nil if @ip.blank?

      Digest::SHA256.hexdigest("#{Rails.application.secret_key_base}:#{Date.current}:#{@ip}")
    end
  end
end
