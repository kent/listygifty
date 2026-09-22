class WorkspaceInvite < ApplicationRecord
  EXPIRY_DAYS = 7

  has_secure_token :token

  belongs_to :workspace
  belongs_to :invited_by, class_name: "User"
  belongs_to :accepted_by, class_name: "User", optional: true

  validates :role, presence: true, inclusion: { in: WorkspaceMembership::ROLES - %w[owner] }
  validates :expires_at, presence: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true

  before_validation :set_expiry, on: :create
  before_destroy :lock_workspace

  scope :valid, -> { where("expires_at > ? AND accepted_at IS NULL", Time.current) }
  scope :expired, -> { where("expires_at <= ?", Time.current) }
  scope :accepted, -> { where.not(accepted_at: nil) }

  def valid_invite?
    expires_at > Time.current && accepted_at.nil?
  end

  def expired?
    expires_at <= Time.current
  end

  def accepted?
    accepted_at.present?
  end

  def accept!(user)
    workspace.with_lock do
      with_lock do
        return false unless valid_invite?
        return false if workspace.member?(user)
        return false if email.present? && !email.casecmp?(user.email)

        update!(accepted_at: Time.current, accepted_by: user)
        workspace.workspace_memberships.create!(user: user, role: role)
      end
    end
    true
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotFound
    false
  end

  def invite_url
    "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}/join/workspace/#{token}"
  end

  private

  def lock_workspace
    Workspace.where(id: workspace_id).lock.pick(:id)
  end

  def set_expiry
    self.expires_at ||= EXPIRY_DAYS.days.from_now
  end
end
