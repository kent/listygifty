class Holiday < ApplicationRecord
  has_secure_token :share_token

  belongs_to :workspace, optional: true # Optional for template holidays
  has_many :holiday_users, dependent: :destroy
  has_many :users, through: :holiday_users
  has_many :holiday_people, dependent: :destroy
  has_many :shared_people, through: :holiday_people, source: :person
  has_many :gifts, dependent: :destroy
  has_many :gift_changes, dependent: :destroy
  has_many :gift_suggestions, dependent: :nullify
  has_many :match_arrangements, dependent: :destroy

  validates :name, presence: true, length: { maximum: 200 }
  validates :icon, length: { maximum: 50 }, allow_blank: true

  scope :templates, -> { where(is_template: true) }
  scope :user_holidays, -> { where(is_template: false) }
  scope :for_workspace, ->(workspace) { where(workspace: workspace) }

  def owner
    holiday_users.find_by(role: "owner")&.user
  end

  def owner?(user)
    holiday_users.exists?(user: user, role: "owner")
  end

  def collaborator?(user)
    holiday_users.exists?(user: user, role: "collaborator")
  end

  def member?(user)
    holiday_users.exists?(user: user)
  end

  def regenerate_share_token!
    regenerate_share_token
    save!
  end
end
