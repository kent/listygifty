# OAuth 2.1 Authorization Code with PKCE support
# Short-lived, one-time use codes that are exchanged for access tokens
class OauthAuthorizationCode < ApplicationRecord
  CODE_LIFETIME = 10.minutes.freeze
  CODE_PREFIX = "lg_code_v2_".freeze
  PKCE_CHALLENGE = /\A[A-Za-z0-9_-]{43}\z/
  PKCE_VERIFIER = /\A[A-Za-z0-9._~-]{43,128}\z/
  CREDENTIAL_VERSION = 2

  belongs_to :oauth_client
  belongs_to :user
  has_one :oauth_access_token, dependent: :nullify

  validates :code_hash, presence: true, uniqueness: true
  validates :redirect_uri, presence: true
  validates :expires_at, :resource, presence: true
  validates :credential_version, inclusion: { in: [ CREDENTIAL_VERSION ] }
  validates :scopes, presence: true
  validates :code_challenge, format: { with: PKCE_CHALLENGE }, allow_nil: true
  validate :pkce_required
  validate :valid_scopes_for_client

  before_validation :normalize_scopes
  before_validation :set_credential_version, on: :create
  before_validation :set_expiration, on: :create

  scope :valid, -> {
    where(credential_version: CREDENTIAL_VERSION, used_at: nil).where("expires_at > ?", Time.current)
  }

  # Generate a new authorization code
  def self.generate_for(client:, user:, redirect_uri:, scopes:, code_challenge:, code_challenge_method:, resource:, state: nil)
    code = "#{CODE_PREFIX}#{SecureRandom.urlsafe_base64(32)}"

    auth_code = create!(
      oauth_client: client,
      user: user,
      code_hash: Digest::SHA256.hexdigest(code),
      credential_version: CREDENTIAL_VERSION,
      redirect_uri: redirect_uri,
      scopes: scopes,
      code_challenge: code_challenge,
      code_challenge_method: code_challenge_method,
      resource: resource,
      state: state
    )

    OpenStruct.new(authorization_code: auth_code, code: code)
  end

  # Find and validate an authorization code
  def self.find_by_code(code)
    return nil unless code.is_a?(String) && code.bytesize <= 256 && code.start_with?(CODE_PREFIX)

    find_by(code_hash: Digest::SHA256.hexdigest(code), credential_version: CREDENTIAL_VERSION)
  end

  # Exchange the code for tokens atomically so concurrent exchanges cannot
  # mint more than one credential from the same one-time code.
  def exchange!(code_verifier:, request: nil)
    result = nil
    exchange_error = nil

    with_lock do
      oauth_client.reload
      exchange_error = exchange_validation_error(code_verifier)
      if exchange_error.nil? && used?
        oauth_access_token&.revoke_refresh_family!
        exchange_error = OauthError.new(
          "invalid_grant",
          "Authorization code replay detected; issued credentials were revoked"
        )
      elsif exchange_error.nil?
        issuance_claimed = OauthClient.active.where(id: oauth_client_id)
          .update_all(updated_at: Time.current) == 1
        unless issuance_claimed
          exchange_error = OauthError.new("invalid_grant", "OAuth client has been revoked")
          next
        end

        oauth_client.reload
        update!(used_at: Time.current)
        result = OauthAccessToken.generate_for(
          client: oauth_client,
          user: user,
          scopes: scopes,
          resource: resource,
          include_refresh: oauth_client.supports_grant_type?("refresh_token"),
          request: request,
          authorization_code: self
        )
      end
    end

    raise exchange_error if exchange_error

    result
  end

  def used?
    used_at.present?
  end

  def expired?
    expires_at <= Time.current
  end

  def valid_for_exchange?
    !used? && !expired?
  end

  private

  def exchange_validation_error(code_verifier)
    return OauthError.new("invalid_grant", "OAuth client has been revoked") unless oauth_client.active?
    unless code_verifier.is_a?(String) && code_verifier.match?(PKCE_VERIFIER)
      return OauthError.new("invalid_grant", "Invalid code verifier")
    end

    expected_challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)
    unless code_challenge_method == "S256" &&
        ActiveSupport::SecurityUtils.secure_compare(expected_challenge, code_challenge)
      return OauthError.new("invalid_grant", "Invalid code verifier")
    end
    return OauthError.new("invalid_grant", "Authorization code has expired") if expired?

    nil
  end

  def normalize_scopes
    self.scopes = Array(scopes).map(&:to_s).uniq.sort
  end

  def valid_scopes_for_client
    invalid = scopes - OauthClient::VALID_SCOPES
    invalid |= scopes.reject { |scope| oauth_client&.can_request_scope?(scope) }
    errors.add(:scopes, "contains values not allowed for this client") if scopes.empty? || invalid.any?
  end

  def set_credential_version
    self.credential_version = CREDENTIAL_VERSION
  end

  def set_expiration
    self.expires_at ||= CODE_LIFETIME.from_now
  end

  def pkce_required
    if code_challenge.blank?
      errors.add(:code_challenge, "PKCE is required")
    elsif code_challenge_method != "S256"
      errors.add(:code_challenge_method, "must be S256 for security")
    end
  end
end
