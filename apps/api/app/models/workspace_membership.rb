class WorkspaceMembership < ApplicationRecord
  ROLES = %w[owner admin member].freeze

  enum :role, { owner: "owner", admin: "admin", member: "member" }, default: :member, validate: true

  belongs_to :workspace
  belongs_to :user

  validates :role, presence: true, inclusion: { in: ROLES }
  validates :user_id, uniqueness: { scope: :workspace_id }

  # Prevent demoting/removing sole owner
  before_validation :lock_workspace, on: :update
  validate :cannot_demote_sole_owner, on: :update
  before_destroy :lock_workspace, prepend: true
  before_destroy :cannot_destroy_sole_owner

  private

  def lock_workspace
    # Save/destroy transactions hold this shared lock through the owner check
    # and mutation, including changes to different membership rows.
    Workspace.where(id: workspace_id).lock.pick(:id)
  end

  def persisted_owner?
    self.class.where(id: id, role: "owner").exists?
  end

  def cannot_demote_sole_owner
    return unless role_changed? && role != "owner" && persisted_owner?
    return if workspace.workspace_memberships.where(role: "owner").count > 1

    errors.add(:role, "cannot demote the only owner")
  end

  def cannot_destroy_sole_owner
    return unless persisted_owner?
    # Skip this check if the workspace itself is being deleted
    return if destroyed_by_association&.active_record == Workspace
    return if workspace.workspace_memberships.where(role: "owner").count > 1

    errors.add(:base, "Cannot remove the only owner")
    throw :abort
  end
end
