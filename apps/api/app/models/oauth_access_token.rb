# OAuth 2.1 access token with opaque, hashed credentials and replay-safe
# refresh-token rotation.
class OauthAccessToken < ApplicationRecord
  ACCESS_TOKEN_LIFETIME = 1.hour
  ACCESS_TOKEN_PREFIX = "lg_oauth_v2_".freeze
  REFRESH_TOKEN_PREFIX = "lg_refresh_v2_".freeze
  CREDENTIAL_VERSION = 2

  belongs_to :oauth_client
  belongs_to :user
  belongs_to :oauth_refresh_grant, optional: true
  belongs_to :oauth_authorization_code, optional: true

  validates :token_hash, presence: true, uniqueness: true
  validates :expires_at, :resource, presence: true
  validates :credential_version, inclusion: { in: [ CREDENTIAL_VERSION ] }
  validate :valid_scopes
  validate :valid_refresh_grant

  before_validation :normalize_scopes
  before_validation :set_credential_version, on: :create
  before_validation :set_expiration, on: :create

  scope :active, -> {
    where(credential_version: CREDENTIAL_VERSION, revoked_at: nil).where("expires_at > ?", Time.current)
  }

  def self.generate_for(
    client:, user:, scopes:, resource:, include_refresh: true, request: nil,
    refresh_grant: nil, authorization_code: nil
  )
    transaction do
      refresh_grant ||= OauthRefreshGrant.issue!(
        client: client,
        user: user,
        scopes: scopes,
        resource: resource
      ) if include_refresh
      validate_refresh_grant!(refresh_grant, client: client, user: user, scopes: scopes, resource: resource) if include_refresh

      access_token = "#{ACCESS_TOKEN_PREFIX}#{SecureRandom.urlsafe_base64(32)}"
      refresh_token = include_refresh ? "#{REFRESH_TOKEN_PREFIX}#{SecureRandom.urlsafe_base64(48)}" : nil
      token = create!(
        oauth_client: client,
        user: user,
        oauth_refresh_grant: refresh_grant,
        oauth_authorization_code: authorization_code,
        credential_version: CREDENTIAL_VERSION,
        token_hash: Digest::SHA256.hexdigest(access_token),
        refresh_token_hash: refresh_token ? Digest::SHA256.hexdigest(refresh_token) : nil,
        scopes: scopes,
        resource: resource,
        refresh_token_expires_at: refresh_grant&.expires_at,
        user_agent: request&.user_agent,
        ip_address: request&.remote_ip
      )

      OpenStruct.new(access_token: token, token: access_token, refresh_token: refresh_token)
    end
  end

  def self.hardened_access_token?(raw_token)
    raw_token.is_a?(String) && raw_token.start_with?(ACCESS_TOKEN_PREFIX)
  end

  def self.hardened_refresh_token?(raw_token)
    raw_token.is_a?(String) && raw_token.start_with?(REFRESH_TOKEN_PREFIX)
  end

  def self.find_by_token(token)
    return nil unless hardened_access_token?(token) && token.bytesize <= 256

    active.joins(:oauth_client).merge(OauthClient.active)
      .find_by(token_hash: Digest::SHA256.hexdigest(token))
  end

  def self.find_by_token_for_revocation(token)
    return nil unless hardened_access_token?(token) && token.bytesize <= 256

    find_by(token_hash: Digest::SHA256.hexdigest(token), credential_version: CREDENTIAL_VERSION)
  end

  # Revoked rows remain discoverable so replay can revoke the active family.
  def self.find_by_refresh_token(refresh_token)
    return nil unless hardened_refresh_token?(refresh_token) && refresh_token.bytesize <= 256

    find_by(
      refresh_token_hash: Digest::SHA256.hexdigest(refresh_token),
      credential_version: CREDENTIAL_VERSION
    )
  end

  def refresh!(request: nil, scopes: nil)
    grant = oauth_refresh_grant
    raise OauthError.new("invalid_grant", "Refresh token family is invalid") unless grant

    requested_scopes = scopes ? Array(scopes).map(&:to_s).uniq.sort : grant.scopes
    unless requested_scopes.any? && (requested_scopes - grant.scopes).empty?
      raise OauthError.new("invalid_scope", "Requested scope exceeds the original grant")
    end

    result = nil
    refresh_error = nil
    grant.with_family_lock do
      with_lock do
        refresh_error = refresh_error_for(grant)
        if refresh_error
          grant.revoke_family_without_lock!
        elsif grant.rotation_count >= OauthRefreshGrant::MAX_ROTATIONS
          refresh_error = OauthError.new("invalid_grant", "Refresh token family exceeded its rotation limit")
          grant.revoke_family_without_lock!
        elsif grant.last_rotated_at && grant.last_rotated_at > OauthRefreshGrant::MIN_ROTATION_INTERVAL.ago
          refresh_error = OauthError.new("temporarily_unavailable", "Refresh rotation is limited to once per minute")
        else
          revoke!
          result = self.class.generate_for(
            client: oauth_client,
            user: user,
            scopes: requested_scopes,
            resource: resource,
            include_refresh: true,
            request: request,
            refresh_grant: grant
          )
          grant.update_columns(
            last_rotated_at: Time.current,
            rotation_count: grant.rotation_count + 1,
            updated_at: Time.current
          )
        end
      end
    end

    raise refresh_error if refresh_error

    result
  end

  def revoke_refresh_family!
    oauth_refresh_grant ? oauth_refresh_grant.revoke_family! : revoke!
  end

  def revoke!
    now = Time.current
    update_columns(revoked_at: now, updated_at: now)
    self.revoked_at = now
  end

  def revoked?
    revoked_at.present?
  end

  def expired?
    expires_at <= Time.current
  end

  def refresh_token_expired?
    refresh_token_expires_at.blank? || refresh_token_expires_at <= Time.current
  end

  def active?
    credential_version == CREDENTIAL_VERSION && !revoked? && !expired? && oauth_client.active?
  end

  def touch_last_used!
    cutoff = 5.minutes.ago
    now = Time.current
    updated = self.class.where(id: id)
      .where("last_used_at IS NULL OR last_used_at < ?", cutoff)
      .update_all(last_used_at: now)
    self.last_used_at = now if updated.positive?
  end

  def can?(scope)
    scopes.include?(scope.to_s)
  end

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

  def self.validate_refresh_grant!(grant, client:, user:, scopes:, resource:)
    valid = grant&.active? &&
      grant.oauth_client_id == client.id &&
      grant.user_id == user.id &&
      grant.resource == resource &&
      (Array(scopes).map(&:to_s).uniq.sort - grant.scopes).empty?
    raise OauthError.new("invalid_grant", "Refresh token family is invalid") unless valid
  end
  private_class_method :validate_refresh_grant!

  def refresh_error_for(grant)
    if grant.revoked_at.present? || revoked?
      OauthError.new("invalid_grant", "Refresh token reuse detected; the token family was revoked")
    elsif grant.expires_at <= Time.current || refresh_token_expired?
      OauthError.new("invalid_grant", "Refresh token has expired")
    elsif !oauth_client.active?
      OauthError.new("invalid_grant", "OAuth client has been revoked")
    end
  end

  def normalize_scopes
    self.scopes = Array(scopes).map(&:to_s).uniq.sort
  end

  def valid_scopes
    invalid = scopes - OauthClient::VALID_SCOPES
    invalid |= scopes.reject { |scope| oauth_client&.can_request_scope?(scope) }
    errors.add(:scopes, "contains values not allowed for this client") if scopes.empty? || invalid.any?
  end

  def valid_refresh_grant
    if refresh_token_hash.present?
      errors.add(:oauth_refresh_grant, "is required with a refresh token") unless oauth_refresh_grant
      errors.add(:refresh_token_expires_at, "is required with a refresh token") if refresh_token_expires_at.blank?
    elsif oauth_refresh_grant_id.present? || refresh_token_expires_at.present?
      errors.add(:refresh_token_hash, "is required for a refresh token grant")
    end
  end

  def set_credential_version
    self.credential_version = CREDENTIAL_VERSION
  end

  def set_expiration
    self.expires_at ||= ACCESS_TOKEN_LIFETIME.from_now
  end
end
