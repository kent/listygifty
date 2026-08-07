class ApiKey < ApplicationRecord
  SCOPES = %w[read write admin].freeze
  KEY_PREFIX = "ng_".freeze
  ADMIN_TTL = 30.days
  RAW_KEY_PATTERN = /\Ang_[A-Za-z0-9_-]{43}\z/

  belongs_to :user

  validates :name, presence: true
  validates :name, length: { maximum: 100 }
  validates :key_prefix, presence: true, uniqueness: true
  validates :key_hash, presence: true
  validate :valid_scopes
  validate :valid_admin_policy

  before_validation :normalize_scopes

  scope :active, -> { where(revoked_at: nil).where("expires_at IS NULL OR expires_at > ?", Time.current) }

  # Generate a new API key for a user
  # Returns OpenStruct with :api_key (the record) and :raw_key (the full key, shown only once)
  def self.generate_for(user, name:, scopes: %w[read write], expires_at: nil)
    scopes = Array(scopes).map(&:to_s).uniq.sort
    expires_at ||= ADMIN_TTL.from_now if scopes.include?("admin")
    raw_key = SecureRandom.urlsafe_base64(32)

    api_key = create!(
      user: user,
      name: name,
      key_prefix: raw_key[0..7],
      key_hash: Digest::SHA256.hexdigest(raw_key),
      scopes: scopes,
      expires_at: expires_at
    )

    # Return both the record and the raw key (can only be retrieved once)
    OpenStruct.new(api_key: api_key, raw_key: "#{KEY_PREFIX}#{raw_key}")
  end

  # Find and validate an API key from its raw form (ng_xxx...)
  # Returns the ApiKey record if valid, nil otherwise
  def self.find_by_raw_key(raw_key)
    return nil unless raw_key&.match?(RAW_KEY_PATTERN)

    actual_key = raw_key.delete_prefix(KEY_PREFIX)
    prefix = actual_key[0..7]

    api_key = active.find_by(key_prefix: prefix)
    return nil unless api_key

    if ActiveSupport::SecurityUtils.secure_compare(Digest::SHA256.hexdigest(actual_key), api_key.key_hash)
      api_key.update_column(:last_used_at, Time.current) if api_key.last_used_at.nil? || api_key.last_used_at < 5.minutes.ago
      api_key
    end
  end

  def revoke!
    update!(revoked_at: Time.current)
  end

  def revoked?
    revoked_at.present?
  end

  def expired?
    expires_at.present? && expires_at <= Time.current
  end

  def active?
    !revoked? && !expired?
  end

  def can?(scope)
    scopes.include?(scope.to_s) || scopes.include?("admin")
  end

  def admin_compliant?
    scopes == [ "admin" ] && expires_at.present? && expires_at <= created_at + ADMIN_TTL && active?
  end

  # Display-safe version of the key (only shows prefix)
  def masked_key
    "#{KEY_PREFIX}#{key_prefix}..."
  end

  private

  def valid_scopes
    return if scopes.blank?

    invalid_scopes = scopes - SCOPES
    if invalid_scopes.any?
      errors.add(:scopes, "contains invalid scopes: #{invalid_scopes.join(', ')}")
    end
  end

  def normalize_scopes
    self.scopes = Array(scopes).map(&:to_s).uniq.sort
  end

  def valid_admin_policy
    return unless scopes.include?("admin")

    errors.add(:scopes, "must contain only admin for an administrator key") unless scopes == [ "admin" ]
    if expires_at.blank?
      errors.add(:expires_at, "is required for an administrator key")
      return
    end

    baseline = created_at || Time.current
    errors.add(:expires_at, "must be no more than 30 days after creation") if expires_at > baseline + ADMIN_TTL + 1.minute
  end
end
