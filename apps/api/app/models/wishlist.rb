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
    return true if share_link_live? && share_token == token
    false
  end

  # A private list can hold a token nobody was given, or one that was switched
  # off, so a token alone does not mean the link works.
  def share_link_live?
    visibility == "shared" && share_token.present?
  end

  # Links get sent to family, so sharing again must hand back the same one.
  def ensure_share_link!
    with_lock { regenerate_share_link! unless share_link_live? }
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

  # An owner with anti-spoiler on must not be able to tell what was claimed until
  # they reveal it. Everyone else needs the real numbers to avoid doubling up.
  def hides_claims_from?(viewer)
    anti_spoiler_enabled && owner?(viewer)
  end

  def claimed_count(viewer: nil)
    claims = WishlistItemClaim.joins(:wishlist_item)
      .where(wishlist_items: { wishlist_id: id, archived_at: nil })
    claims = claims.revealed if hides_claims_from?(viewer)
    claims.sum(:quantity)
  end

  def total_claimed_items
    claims.count
  end

  def hidden_claims_count
    return 0 unless anti_spoiler_enabled
    claims.where(revealed_at: nil).count
  end
end
