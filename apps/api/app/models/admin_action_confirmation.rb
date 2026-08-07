class AdminActionConfirmation < ApplicationRecord
  CONFIRMATION_TTL = 15.minutes
  ACTIONS = %w[delete_user].freeze

  belongs_to :actor, class_name: "User"
  belongs_to :api_key, optional: true
  belongs_to :oauth_access_token, optional: true

  validates :action, presence: true, inclusion: { in: ACTIONS }
  validates :target_type, :target_id, :target_label, :confirmation_digest, :expires_at, presence: true
  validates :confirmation_digest, uniqueness: true
  validate :exactly_one_credential

  def self.create_with_token!(actor:, credential:, action:, target:, target_label:, payload: {})
    token = SecureRandom.urlsafe_base64(32)
    confirmation = create!(
      actor: actor,
      **Admin::Credential.wrap(credential).binding_attributes,
      action: action,
      target_type: target.class.name,
      target_id: target.id,
      target_label: target_label,
      payload: payload,
      confirmation_digest: Digest::SHA256.hexdigest(token),
      expires_at: CONFIRMATION_TTL.from_now
    )
    [ confirmation, token ]
  end

  def self.find_by_token(token)
    find_by(confirmation_digest: Digest::SHA256.hexdigest(token.to_s))
  end

  def expired?
    expires_at <= Time.current
  end

  def consumed?
    consumed_at.present?
  end

  private

  def exactly_one_credential
    count = [ api_key_id, oauth_access_token_id ].count(&:present?)
    errors.add(:base, "must be bound to exactly one admin credential") unless count == 1
  end
end
