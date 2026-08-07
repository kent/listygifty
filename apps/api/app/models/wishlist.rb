class Wishlist < ApplicationRecord
  VISIBILITIES = %w[private workspace shared].freeze

  belongs_to :user
  belongs_to :workspace
  has_many :wishlist_items, dependent: :destroy
  has_many :claims, through: :wishlist_items

  has_secure_token :share_token

  validates :name, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5_000 }, allow_blank: true
  validates :visibility, presence: true, inclusion: { in: VISIBILITIES }

  scope :visible_to, ->(user, workspace) {
    where(visibility: "workspace", workspace: workspace)
      .or(where(user: user, workspace: workspace))
  }
  scope :shared, -> { where(visibility: "shared") }
  scope :owned_by, ->(user) { where(user: user) }

  def owner?(check_user)
    user_id == check_user&.id
  end

  def accessible_by?(check_user, token: nil)
    return true if owner?(check_user)
    return true if visibility == "workspace" && workspace.member?(check_user)
    return true if visibility == "shared" && share_token.present? && share_token == token
    false
  end

  def regenerate_share_link!
    regenerate_share_token
    self.visibility = "shared"
    save!
  end

  def revoke_share_link!
    update!(share_token: nil, visibility: "private")
  end

  def item_count
    wishlist_items.active.count
  end

  def claimed_count
    WishlistItemClaim.joins(:wishlist_item)
      .where(wishlist_items: { wishlist_id: id, archived_at: nil })
      .sum(:quantity)
  end

  def total_claimed_items
    claims.count
  end

  def hidden_claims_count
    return 0 unless anti_spoiler_enabled
    claims.where(revealed_at: nil).count
  end
end
