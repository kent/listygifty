module Admin
  class Credential
    SUPPORTED_TYPES = [ ApiKey, OauthAccessToken ].freeze

    attr_reader :record

    def self.wrap(value)
      value.is_a?(self) ? value : new(value)
    end

    def initialize(record)
      raise ArgumentError, "Unsupported admin credential" unless SUPPORTED_TYPES.any? { |type| record.is_a?(type) }

      @record = record
    end

    def binding_attributes
      if record.is_a?(ApiKey)
        { api_key: record, oauth_access_token: nil }
      else
        { api_key: nil, oauth_access_token: record }
      end
    end

    def matches?(bound_record)
      if record.is_a?(ApiKey)
        bound_record.api_key_id == record.id && bound_record.oauth_access_token_id.nil?
      else
        bound_record.oauth_access_token_id == record.id && bound_record.api_key_id.nil?
      end
    end

    def label
      record.is_a?(ApiKey) ? "API key" : "OAuth access token"
    end

    def audit_metadata
      if record.is_a?(ApiKey)
        { authentication_method: "api_key", api_key_id: record.id }
      else
        { authentication_method: "oauth", oauth_access_token_id: record.id, oauth_client_id: record.oauth_client_id }
      end
    end
  end
end
