# OAuth 2.1 Client implementation following RFC 7591 (Dynamic Client Registration)
# and draft-ietf-oauth-client-id-metadata-document for Client ID Metadata Documents
class OauthClient < ApplicationRecord
  VALID_GRANT_TYPES = %w[authorization_code refresh_token].freeze
  VALID_RESPONSE_TYPES = %w[code].freeze
  VALID_AUTH_METHODS = %w[none client_secret_basic client_secret_post].freeze
  VALID_SCOPES = %w[read write admin].freeze

  belongs_to :user, optional: true
  has_many :oauth_authorization_requests, dependent: :destroy
  has_many :oauth_refresh_grants, dependent: :destroy
  has_many :oauth_authorization_codes, dependent: :destroy
  has_many :oauth_access_tokens, dependent: :destroy

  validates :client_id, presence: true, uniqueness: true
  validates :name, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 2_000 }, allow_nil: true
  validates :client_uri, :logo_uri, length: { maximum: 2_000 }, allow_nil: true
  validates :redirect_uris, :grant_types, :response_types, :scopes, presence: true
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
      client.grant_types = [ "authorization_code", "refresh_token" ]
      client.response_types = [ "code" ]
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
      grant_types: metadata[:grant_types] || [ "authorization_code", "refresh_token" ],
      response_types: metadata[:response_types] || [ "code" ],
      token_endpoint_auth_method: metadata[:token_endpoint_auth_method] || "none",
      scopes: metadata[:scopes] || VALID_SCOPES,
      is_dynamic: true
    )
  end

  def verify_secret(secret)
    return false unless client_secret_hash.present? &&
      secret.is_a?(String) && secret.bytesize.between?(1, 1_024)

    ActiveSupport::SecurityUtils.secure_compare(Digest::SHA256.hexdigest(secret), client_secret_hash)
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
    resolve_redirect_uri(uri).present?
  end

  # RFC 8252 loopback redirects use an ephemeral listener port. HTTPS and
  # non-loopback redirects still require exact string equality.
  def resolve_redirect_uri(uri)
    return uri if uri.is_a?(String) && redirect_uris.include?(uri)
    return nil unless uri.is_a?(String)

    requested = URI.parse(uri)
    return nil unless safe_loopback_redirect?(requested)

    registered = redirect_uris.find do |registered_uri|
      candidate = URI.parse(registered_uri)
      safe_loopback_redirect?(candidate) &&
        candidate.scheme == requested.scheme &&
        candidate.host == requested.host &&
        candidate.path == requested.path &&
        candidate.query == requested.query
    rescue URI::InvalidURIError
      false
    end
    registered ? uri : nil
  rescue URI::InvalidURIError
    nil
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

  def safe_loopback_redirect?(uri)
    uri.scheme == "http" &&
      %w[localhost 127.0.0.1 ::1 [::1]].include?(uri.host) &&
      uri.absolute? && uri.userinfo.nil? && uri.fragment.nil?
  end

  def valid_redirect_uris
    return if redirect_uris.blank?
    unless redirect_uris.is_a?(Array) && redirect_uris.length <= 20 && redirect_uris.all? { |uri| uri.is_a?(String) && uri.bytesize <= 2_000 }
      errors.add(:redirect_uris, "must be an array of at most 20 URI strings")
      return
    end

    redirect_uris.each do |uri|
      parsed = URI.parse(uri)
      valid_loopback = %w[localhost 127.0.0.1 ::1 [::1]].include?(parsed.host) && parsed.scheme == "http"
      valid_https = parsed.scheme == "https" && parsed.host.present?
      if !parsed.absolute? || parsed.userinfo.present? || parsed.fragment.present? || (!valid_loopback && !valid_https)
        errors.add(:redirect_uris, "must be an absolute HTTPS URI or HTTP loopback URI without userinfo or fragments: #{uri}")
      end
    rescue URI::InvalidURIError
      errors.add(:redirect_uris, "contains invalid URI: #{uri}")
    end
  end

  def valid_grant_types_list
    validate_metadata_list(:grant_types, VALID_GRANT_TYPES)
  end

  def valid_response_types_list
    validate_metadata_list(:response_types, VALID_RESPONSE_TYPES)
  end

  def valid_auth_method
    return if token_endpoint_auth_method.blank?
    unless VALID_AUTH_METHODS.include?(token_endpoint_auth_method)
      errors.add(:token_endpoint_auth_method, "is invalid")
    end
  end

  def valid_scopes_list
    validate_metadata_list(:scopes, VALID_SCOPES)
  end

  def validate_metadata_list(attribute, allowed_values)
    values = public_send(attribute)
    return if values.blank?
    unless values.is_a?(Array) && values.length <= 20 && values.all?(String)
      errors.add(attribute, "must be an array of at most 20 strings")
      return
    end

    invalid = values - allowed_values
    errors.add(attribute, "contains invalid values: #{invalid.join(', ')}") if invalid.any?
  end
end
