class WishlistItem < ApplicationRecord
  PRIORITIES = { normal: 0, high: 1, most_wanted: 2 }.freeze

  belongs_to :wishlist
  has_many :claims, class_name: "WishlistItemClaim", dependent: :destroy

  validates :name, presence: true, length: { maximum: 500 }
  validates :notes, length: { maximum: 5_000 }, allow_blank: true
  validates :url, length: { maximum: 2_048 }, allow_blank: true
  validates :image_url, length: { maximum: 2_048 }, allow_blank: true
  validates :price_min, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :price_max, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :quantity, numericality: { greater_than: 0 }
  validates :priority, inclusion: { in: PRIORITIES.values }
  validates :url, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]), message: "must be a valid URL" }, allow_blank: true
  validate :price_range_valid

  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :by_priority, -> { order(priority: :desc, position: :asc) }
  scope :by_position, -> { order(:position) }
  scope :available, -> { active.where("quantity > (SELECT COALESCE(SUM(quantity), 0) FROM wishlist_item_claims WHERE wishlist_item_claims.wishlist_item_id = wishlist_items.id)") }

  before_create :set_position

  delegate :workspace, :user, to: :wishlist

  def fully_claimed?
    claimed_quantity >= quantity
  end

  def available_quantity
    [ quantity - claimed_quantity, 0 ].max
  end

  def claimed_quantity
    claims.sum(:quantity)
  end

  def archived?
    archived_at.present?
  end

  def archive!
    update!(archived_at: Time.current)
  end

  def unarchive!
    update!(archived_at: nil)
  end

  def price_display
    return nil if price_min.nil? && price_max.nil?

    format_price = ->(price) { "$#{'%.2f' % price}" }

    return format_price.call(price_min) if price_max.nil? || price_min == price_max
    return "Up to #{format_price.call(price_max)}" if price_min.nil?
    "#{format_price.call(price_min)} - #{format_price.call(price_max)}"
  end

  private

  def price_range_valid
    return unless price_min.present? && price_max.present?
    if price_min > price_max
      errors.add(:price_max, "must be greater than or equal to minimum price")
    end
  end

  def set_position
    return if position.present? && position > 0

    max_position = wishlist.wishlist_items.maximum(:position) || -1
    self.position = max_position + 1
  end
end
