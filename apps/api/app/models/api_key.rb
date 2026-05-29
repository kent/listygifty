class ApiKey < ApplicationRecord
  SCOPES = %w[read write admin].freeze
  KEY_PREFIX = "ng_".freeze

  belongs_to :user

  validates :name, presence: true
  validates :key_prefix, presence: true, uniqueness: true
  validates :key_hash, presence: true
  validate :valid_scopes

  scope :active, -> { where(revoked_at: nil).where("expires_at IS NULL OR expires_at > ?", Time.current) }

  # Generate a new API key for a user
  # Returns OpenStruct with :api_key (the record) and :raw_key (the full key, shown only once)
  def self.generate_for(user, name:, scopes: %w[read write], expires_at: nil)
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
    return nil unless raw_key&.start_with?(KEY_PREFIX)

    actual_key = raw_key.delete_prefix(KEY_PREFIX)
    prefix = actual_key[0..7]

    api_key = active.find_by(key_prefix: prefix)
    return nil unless api_key

    if ActiveSupport::SecurityUtils.secure_compare(Digest::SHA256.hexdigest(actual_key), api_key.key_hash)
      api_key.touch(:last_used_at)
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
end
