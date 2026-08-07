class AdminEmailDraft < ApplicationRecord
  CONFIRMATION_TTL = 15.minutes

  belongs_to :created_by, class_name: "User"
  belongs_to :recipient, class_name: "User"
  belongs_to :api_key, optional: true
  belongs_to :oauth_access_token, optional: true

  validates :recipient_email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :subject, presence: true, length: { maximum: 200 }
  validates :body, presence: true, length: { maximum: 20_000 }
  validates :confirmation_digest, presence: true, uniqueness: true
  validates :expires_at, presence: true
  validate :exactly_one_credential

  scope :pending, -> { where(queued_at: nil).where("expires_at > ?", Time.current) }

  def self.create_with_confirmation!(created_by:, recipient:, credential:, subject:, body:)
    token = SecureRandom.urlsafe_base64(32)
    draft = create!(
      created_by: created_by,
      recipient: recipient,
      **Admin::Credential.wrap(credential).binding_attributes,
      recipient_email: recipient.email,
      subject: subject.to_s.strip,
      body: body.to_s,
      confirmation_digest: digest(token),
      expires_at: CONFIRMATION_TTL.from_now
    )
    [ draft, token ]
  end

  def self.find_by_confirmation(token)
    find_by(confirmation_digest: digest(token.to_s))
  end

  def expired?
    expires_at <= Time.current
  end

  def consumed?
    queued_at.present?
  end

  def self.digest(token)
    Digest::SHA256.hexdigest(token)
  end

  private

  def exactly_one_credential
    count = [ api_key_id, oauth_access_token_id ].count(&:present?)
    errors.add(:base, "must be bound to exactly one admin credential") unless count == 1
  end
end
