class Wishlist < ApplicationRecord
  VISIBILITIES = %w[private workspace shared].freeze
  DEFAULT_NAME = "My Wishlist".freeze

  belongs_to :user
  belongs_to :workspace
  has_many :wishlist_items, dependent: :destroy
  has_many :claims, through: :wishlist_items
  # Exchanges show this list to the owner's Secret Santa.
  has_many :exchange_participants, dependent: :nullify

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

  # Exchanges where the owner uses this list.
  def linked_exchanges
    GiftExchange.where(id: exchange_participants.where(user_id: user_id).select(:gift_exchange_id))
  end

  # Puts every active item in the given order. The ids must be exactly the
  # active items, so a stale screen can't drop or invent one.
  def reorder!(item_ids:)
    ids = Array(item_ids).map { |id| Integer(id.to_s, exception: false) }
    with_lock do
      active_ids = wishlist_items.active.pluck(:id)
      unless ids.size == active_ids.size && ids.compact.sort == active_ids.sort
        raise ArgumentError, "item_ids must list every item on the wishlist exactly once"
      end

      now = Time.current
      ids.each_with_index do |id, position|
        wishlist_items.where(id: id).update_all(position: position, updated_at: now)
      end
    end
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
