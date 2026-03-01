# OAuth 2.1 Access Token implementation
# Supports bearer tokens with refresh token rotation
class OauthAccessToken < ApplicationRecord
  ACCESS_TOKEN_LIFETIME = 1.hour.freeze
  REFRESH_TOKEN_LIFETIME = 30.days.freeze

  belongs_to :oauth_client
  belongs_to :user

  validates :token_hash, presence: true, uniqueness: true
  validates :expires_at, presence: true

  before_validation :set_expiration, on: :create

  scope :active, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }
  scope :with_valid_refresh, -> { where(revoked_at: nil).where("refresh_token_expires_at > ?", Time.current) }

  # Generate a new access token with optional refresh token
  def self.generate_for(client:, user:, scopes:, resource: nil, include_refresh: true, request: nil)
    access_token = SecureRandom.urlsafe_base64(32)
    refresh_token = include_refresh ? SecureRandom.urlsafe_base64(48) : nil

    token = create!(
      oauth_client: client,
      user: user,
      token_hash: Digest::SHA256.hexdigest(access_token),
      refresh_token_hash: refresh_token ? Digest::SHA256.hexdigest(refresh_token) : nil,
      scopes: scopes,
      resource: resource,
      refresh_token_expires_at: refresh_token ? REFRESH_TOKEN_LIFETIME.from_now : nil,
      user_agent: request&.user_agent,
      ip_address: request&.remote_ip
    )

    OpenStruct.new(
      access_token: token,
      token: access_token,
      refresh_token: refresh_token
    )
  end

  # Find an active token by raw value
  def self.find_by_token(token)
    return nil unless token.present?
    active.find_by(token_hash: Digest::SHA256.hexdigest(token))
  end

  # Find a token by refresh token for rotation
  def self.find_by_refresh_token(refresh_token)
    return nil unless refresh_token.present?
    with_valid_refresh.find_by(refresh_token_hash: Digest::SHA256.hexdigest(refresh_token))
  end

  # Refresh the token (rotate refresh token for public clients per OAuth 2.1)
  def refresh!(request: nil)
    raise OauthError.new("invalid_grant", "Token has been revoked") if revoked?
    raise OauthError.new("invalid_grant", "Refresh token has expired") if refresh_token_expired?

    # Revoke this token
    revoke!

    # Generate new tokens
    self.class.generate_for(
      client: oauth_client,
      user: user,
      scopes: scopes,
      resource: resource,
      include_refresh: true,
      request: request
    )
  end

  def revoke!
    update!(revoked_at: Time.current)
  end

  def revoked?
    revoked_at.present?
  end

  def expired?
    expires_at <= Time.current
  end

  def refresh_token_expired?
    refresh_token_expires_at.present? && refresh_token_expires_at <= Time.current
  end

  def active?
    !revoked? && !expired?
  end

  def touch_last_used!
    update_column(:last_used_at, Time.current)
  end

  def can?(scope)
    scopes.include?(scope.to_s)
  end

  # Returns the token response for OAuth token endpoint
  def to_token_response(access_token_value, refresh_token_value = nil)
    response = {
      access_token: access_token_value,
      token_type: "Bearer",
      expires_in: [ (expires_at - Time.current).to_i, 0 ].max,
      scope: scopes.join(" ")
    }
    response[:refresh_token] = refresh_token_value if refresh_token_value
    response
  end

  private

  def set_expiration
    self.expires_at ||= ACCESS_TOKEN_LIFETIME.from_now
  end
end
