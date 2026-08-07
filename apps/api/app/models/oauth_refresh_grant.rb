class OauthRefreshGrant < ApplicationRecord
  GRANT_LIFETIME = 30.days
  MIN_ROTATION_INTERVAL = 1.minute
  MAX_ROTATIONS = 1_000

  belongs_to :oauth_client
  belongs_to :user
  has_many :oauth_access_tokens, dependent: :nullify

  validates :family_id, presence: true, uniqueness: true
  validates :resource, :expires_at, presence: true
  validate :valid_scopes

  before_validation :normalize_scopes

  def self.issue!(client:, user:, scopes:, resource:)
    create!(
      family_id: SecureRandom.uuid,
      oauth_client: client,
      user: user,
      scopes: scopes,
      resource: resource,
      expires_at: GRANT_LIFETIME.from_now
    )
  end

  def active?
    revoked_at.nil? && expires_at > Time.current && oauth_client.active?
  end

  # Callers that need to mint a descendant take this stable row lock first,
  # serializing refresh and replay across every token in the family.
  def with_family_lock(&)
    with_lock(&)
  end

  def revoke_family!
    with_family_lock { revoke_family_without_lock! }
  end

  def revoke_family_without_lock!
    now = Time.current
    unless revoked_at
      update_columns(revoked_at: now, updated_at: now)
      self.revoked_at = now
    end
    oauth_access_tokens.where(revoked_at: nil).update_all(revoked_at: now, updated_at: now)
  end

  private

  def normalize_scopes
    self.scopes = Array(scopes).map(&:to_s).uniq.sort
  end

  def valid_scopes
    invalid = scopes - OauthClient::VALID_SCOPES
    invalid |= scopes.reject { |scope| oauth_client&.can_request_scope?(scope) }
    errors.add(:scopes, "contains values not allowed for this client") if scopes.empty? || invalid.any?
  end
end
