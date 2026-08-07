class AdminActionConfirmation < ApplicationRecord
  CONFIRMATION_TTL = 15.minutes
  ACTIONS = %w[delete_user].freeze

  belongs_to :actor, class_name: "User"
  belongs_to :api_key

  validates :action, presence: true, inclusion: { in: ACTIONS }
  validates :target_type, :target_id, :target_label, :confirmation_digest, :expires_at, presence: true
  validates :confirmation_digest, uniqueness: true

  def self.create_with_token!(actor:, api_key:, action:, target:, target_label:, payload: {})
    token = SecureRandom.urlsafe_base64(32)
    confirmation = create!(
      actor: actor,
      api_key: api_key,
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
end
