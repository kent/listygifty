class Workspace < ApplicationRecord
  TYPES = %w[personal business].freeze

  belongs_to :created_by_user, class_name: "User"
  has_many :workspace_memberships, dependent: :destroy
  has_many :users, through: :workspace_memberships
  has_one :company_profile, dependent: :destroy
  has_many :workspace_invites, dependent: :destroy

  # Scoped resources
  has_many :people, dependent: :destroy
  has_many :holidays, dependent: :destroy
  has_many :gift_exchanges, dependent: :destroy
  has_many :wishlists, dependent: :destroy

  validates :name, presence: true, length: { maximum: 200 }
  validates :workspace_type, presence: true, inclusion: { in: TYPES }

  scope :personal, -> { where(workspace_type: "personal") }
  scope :business, -> { where(workspace_type: "business") }

  def personal?
    workspace_type == "personal"
  end

  def business?
    workspace_type == "business"
  end

  def owner
    workspace_memberships.find_by(role: "owner")&.user
  end

  def owner?(user)
    workspace_memberships.exists?(user: user, role: "owner")
  end

  def admin?(user)
    workspace_memberships.exists?(user: user, role: %w[owner admin])
  end

  def member?(user)
    workspace_memberships.exists?(user: user)
  end

  def membership_for(user)
    workspace_memberships.find_by(user: user)
  end

  def role_for(user)
    membership_for(user)&.role
  end
end
