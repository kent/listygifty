class Person < ApplicationRecord
  belongs_to :user
  belongs_to :workspace
  belongs_to :default_shipping_address,
    class_name: "Address",
    optional: true,
    inverse_of: :default_shipping_people
  has_many :gift_recipients, dependent: :destroy
  has_many :gifts_received, through: :gift_recipients, source: :gift
  has_many :gift_givers, dependent: :destroy
  has_many :gifts_given, through: :gift_givers, source: :gift
  has_many :gift_suggestions, dependent: :destroy
  has_many :holiday_people, dependent: :destroy
  has_many :shared_holidays, through: :holiday_people, source: :holiday
  has_many :match_slots, dependent: :destroy

  validates :name, presence: true, length: { maximum: 200 }
  validates :email, length: { maximum: 254 }, uniqueness: { scope: :workspace_id, allow_blank: true }
  validates :gender, length: { maximum: 50 }, allow_blank: true
  validates :milestone_label, length: { maximum: 200 }, allow_blank: true
  validates :relationship, length: { maximum: 100 }, allow_blank: true
  validates :notes, length: { maximum: 5_000 }, allow_blank: true
  validate :default_shipping_address_belongs_to_workspace, if: :default_shipping_address_id

  # Check if user can access this person (workspace member or shared to a common holiday)
  def editable_by?(user)
    workspace.member?(user)
  end

  def shipping_address_editable_by?(user)
    workspace.admin?(user)
  end

  def accessible_by?(user)
    return true if workspace.member?(user)
    shared_holidays.joins(:holiday_users).where(holiday_users: { user_id: user.id }).exists?
  end

  private

  def default_shipping_address_belongs_to_workspace
    return if default_shipping_address&.workspace == workspace

    errors.add(:default_shipping_address, "must belong to the same workspace")
  end
end
