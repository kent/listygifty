# OAuth 2.1 Authorization Code with PKCE support
# Short-lived, one-time use codes that are exchanged for access tokens
class OauthAuthorizationCode < ApplicationRecord
  CODE_LIFETIME = 10.minutes.freeze

  belongs_to :oauth_client
  belongs_to :user

  validates :code_hash, presence: true, uniqueness: true
  validates :redirect_uri, presence: true
  validates :expires_at, presence: true
  validate :pkce_required

  before_validation :set_expiration, on: :create

  scope :valid, -> { where(used_at: nil).where("expires_at > ?", Time.current) }

  # Generate a new authorization code
  def self.generate_for(client:, user:, redirect_uri:, scopes:, code_challenge: nil, code_challenge_method: nil, resource: nil, state: nil)
    code = SecureRandom.urlsafe_base64(32)

    auth_code = create!(
      oauth_client: client,
      user: user,
      code_hash: Digest::SHA256.hexdigest(code),
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
    return nil unless code.present?
    valid.find_by(code_hash: Digest::SHA256.hexdigest(code))
  end

  # Exchange the code for tokens
  def exchange!(code_verifier: nil)
    raise OauthError.new("invalid_grant", "Authorization code has already been used") if used?
    raise OauthError.new("invalid_grant", "Authorization code has expired") if expired?

    # Verify PKCE
    if code_challenge.present?
      raise OauthError.new("invalid_grant", "Code verifier is required") unless code_verifier.present?

      expected_challenge = case code_challenge_method
      when "S256"
        Base64.urlsafe_encode64(Digest::SHA256.digest(code_verifier), padding: false)
      when "plain"
        code_verifier
      else
        raise OauthError.new("invalid_grant", "Unsupported code challenge method")
      end

      unless ActiveSupport::SecurityUtils.secure_compare(expected_challenge, code_challenge)
        raise OauthError.new("invalid_grant", "Invalid code verifier")
      end
    end

    # Mark as used
    update!(used_at: Time.current)

    # Generate access token
    OauthAccessToken.generate_for(
      client: oauth_client,
      user: user,
      scopes: scopes,
      resource: resource
    )
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

  def set_expiration
    self.expires_at ||= CODE_LIFETIME.from_now
  end

  def pkce_required
    # PKCE is required for OAuth 2.1
    # We allow missing code_challenge only for system clients that may have legacy support
    return if oauth_client&.is_system?

    if code_challenge.blank?
      errors.add(:code_challenge, "PKCE is required")
    elsif code_challenge_method.blank?
      errors.add(:code_challenge_method, "is required when code_challenge is present")
    elsif code_challenge_method != "S256"
      errors.add(:code_challenge_method, "must be S256 for security")
    end
  end
end
