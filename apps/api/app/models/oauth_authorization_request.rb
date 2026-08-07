class OauthAuthorizationRequest < ApplicationRecord
  REQUEST_LIFETIME = 10.minutes
  REQUEST_TOKEN_PREFIX = "lg_request_v2_".freeze
  PKCE_CHALLENGE = /\A[A-Za-z0-9_-]{43}\z/
  DECISIONS = %w[approve deny].freeze

  belongs_to :oauth_client
  belongs_to :user, optional: true

  validates :request_digest, presence: true, uniqueness: true
  validates :redirect_uri, :resource, :expires_at, presence: true
  validates :scopes, presence: true
  validates :code_challenge, format: { with: PKCE_CHALLENGE }
  validates :code_challenge_method, inclusion: { in: %w[S256] }
  validates :decision, inclusion: { in: DECISIONS }, allow_nil: true
  validate :valid_scopes_for_client

  before_validation :normalize_scopes

  scope :pending, -> { where(consumed_at: nil).where("expires_at > ?", Time.current) }

  def self.issue!(client:, redirect_uri:, scopes:, code_challenge:, resource:, state: nil)
    raw_token = "#{REQUEST_TOKEN_PREFIX}#{SecureRandom.urlsafe_base64(32)}"
    authorization_request = create!(
      oauth_client: client,
      request_digest: digest(raw_token),
      redirect_uri: redirect_uri,
      scopes: scopes,
      code_challenge: code_challenge,
      code_challenge_method: "S256",
      resource: resource,
      state: state,
      expires_at: REQUEST_LIFETIME.from_now
    )
    OpenStruct.new(authorization_request: authorization_request, token: raw_token)
  end

  def self.find_by_token(raw_token)
    return nil unless raw_token.is_a?(String) && raw_token.bytesize <= 256 && raw_token.start_with?(REQUEST_TOKEN_PREFIX)

    find_by(request_digest: digest(raw_token))
  end

  def claim!(claiming_user)
    with_lock do
      raise OauthError.new("invalid_request", "Authorization request has expired") if expired?
      raise OauthError.new("invalid_request", "Authorization request has already been used") if consumed?
      if user_id.present? && user_id != claiming_user.id
        raise OauthError.new("access_denied", "Authorization request belongs to another user")
      end

      update!(user: claiming_user) if user_id.nil?
    end
    self
  end

  def consume!(decision:)
    raise OauthError.new("invalid_request", "Authorization request has expired") if expired?
    raise OauthError.new("invalid_request", "Authorization request has already been used") if consumed?

    update!(decision: decision, consumed_at: Time.current)
  end

  def expired?
    expires_at <= Time.current
  end

  def consumed?
    consumed_at.present?
  end


  private

  def normalize_scopes
    self.scopes = Array(scopes).map(&:to_s).uniq.sort
  end

  def valid_scopes_for_client
    invalid = scopes - OauthClient::VALID_SCOPES
    invalid |= scopes.reject { |scope| oauth_client&.can_request_scope?(scope) }
    errors.add(:scopes, "contains values not allowed for this client") if scopes.empty? || invalid.any?
  end

  def self.digest(raw_token)
    Digest::SHA256.hexdigest(raw_token.to_s)
  end
end
