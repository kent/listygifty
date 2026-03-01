# OAuth 2.1 Client implementation following RFC 7591 (Dynamic Client Registration)
# and draft-ietf-oauth-client-id-metadata-document for Client ID Metadata Documents
class OauthClient < ApplicationRecord
  VALID_GRANT_TYPES = %w[authorization_code refresh_token].freeze
  VALID_RESPONSE_TYPES = %w[code].freeze
  VALID_AUTH_METHODS = %w[none client_secret_basic client_secret_post private_key_jwt].freeze
  VALID_SCOPES = %w[read write admin].freeze

  belongs_to :user, optional: true
  has_many :oauth_authorization_codes, dependent: :destroy
  has_many :oauth_access_tokens, dependent: :destroy

  validates :client_id, presence: true, uniqueness: true
  validates :name, presence: true
  validates :redirect_uris, presence: true
  validate :valid_redirect_uris
  validate :valid_grant_types_list
  validate :valid_response_types_list
  validate :valid_auth_method
  validate :valid_scopes_list

  scope :active, -> { where(revoked_at: nil) }
  scope :system_clients, -> { where(is_system: true) }

  # Generate a new OAuth client with credentials
  def self.generate(name:, redirect_uris:, user: nil, scopes: %w[read write], is_confidential: false, **attrs)
    client_id = SecureRandom.urlsafe_base64(32)
    client_secret = is_confidential ? SecureRandom.urlsafe_base64(48) : nil

    client = create!(
      client_id: client_id,
      client_secret_hash: client_secret ? Digest::SHA256.hexdigest(client_secret) : nil,
      name: name,
      redirect_uris: Array(redirect_uris),
      scopes: scopes,
      user: user,
      token_endpoint_auth_method: is_confidential ? "client_secret_basic" : "none",
      **attrs
    )

    OpenStruct.new(client: client, client_id: client_id, client_secret: client_secret)
  end

  # Register a system client (like Claude) with known credentials
  def self.register_system_client(name:, client_id:, redirect_uris:, **attrs)
    find_or_create_by!(client_id: client_id) do |client|
      client.name = name
      client.redirect_uris = Array(redirect_uris)
      client.is_system = true
      client.grant_types = ["authorization_code", "refresh_token"]
      client.response_types = ["code"]
      client.scopes = %w[read write]
      attrs.each { |k, v| client.send("#{k}=", v) }
    end
  end

  # Dynamic Client Registration (RFC 7591)
  def self.dynamic_register(metadata)
    client_id = SecureRandom.urlsafe_base64(32)

    create!(
      client_id: client_id,
      name: metadata[:client_name] || "Dynamic Client",
      description: metadata[:client_description],
      logo_uri: metadata[:logo_uri],
      client_uri: metadata[:client_uri],
      redirect_uris: Array(metadata[:redirect_uris]),
      grant_types: metadata[:grant_types] || ["authorization_code"],
      response_types: metadata[:response_types] || ["code"],
      token_endpoint_auth_method: metadata[:token_endpoint_auth_method] || "none",
      scopes: metadata[:scopes] || %w[read write],
      is_dynamic: true
    )
  end

  def verify_secret(secret)
    return false unless client_secret_hash.present?
    Digest::SHA256.hexdigest(secret) == client_secret_hash
  end

  def confidential?
    client_secret_hash.present?
  end

  def public_client?
    !confidential?
  end

  def revoke!
    update!(revoked_at: Time.current)
  end

  def revoked?
    revoked_at.present?
  end

  def active?
    !revoked?
  end

  def supports_grant_type?(type)
    grant_types.include?(type.to_s)
  end

  def supports_response_type?(type)
    response_types.include?(type.to_s)
  end

  def valid_redirect_uri?(uri)
    redirect_uris.include?(uri)
  end

  def can_request_scope?(scope)
    scopes.include?(scope.to_s)
  end

  # Returns metadata for OAuth 2.0 Dynamic Client Registration response
  def to_registration_response
    {
      client_id: client_id,
      client_name: name,
      client_uri: client_uri,
      logo_uri: logo_uri,
      redirect_uris: redirect_uris,
      grant_types: grant_types,
      response_types: response_types,
      token_endpoint_auth_method: token_endpoint_auth_method,
      scope: scopes.join(" ")
    }.compact
  end

  private

  def valid_redirect_uris
    return if redirect_uris.blank?

    redirect_uris.each do |uri|
      begin
        parsed = URI.parse(uri)
        # Allow localhost and 127.0.0.1 for development
        if parsed.host == "localhost" || parsed.host == "127.0.0.1"
          next
        end
        # Require HTTPS for non-localhost URIs
        unless parsed.scheme == "https"
          errors.add(:redirect_uris, "must use HTTPS for non-localhost URIs: #{uri}")
        end
      rescue URI::InvalidURIError
        errors.add(:redirect_uris, "contains invalid URI: #{uri}")
      end
    end
  end

  def valid_grant_types_list
    return if grant_types.blank?
    invalid = grant_types - VALID_GRANT_TYPES
    errors.add(:grant_types, "contains invalid types: #{invalid.join(', ')}") if invalid.any?
  end

  def valid_response_types_list
    return if response_types.blank?
    invalid = response_types - VALID_RESPONSE_TYPES
    errors.add(:response_types, "contains invalid types: #{invalid.join(', ')}") if invalid.any?
  end

  def valid_auth_method
    return if token_endpoint_auth_method.blank?
    unless VALID_AUTH_METHODS.include?(token_endpoint_auth_method)
      errors.add(:token_endpoint_auth_method, "is invalid")
    end
  end

  def valid_scopes_list
    return if scopes.blank?
    invalid = scopes - VALID_SCOPES
    errors.add(:scopes, "contains invalid scopes: #{invalid.join(', ')}") if invalid.any?
  end
end
