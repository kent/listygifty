class ExchangeWishlistItem < ApplicationRecord
  MAX_PHOTO_BYTES = 5 * 1024 * 1024
  MAX_PHOTO_STORAGE_PER_USER_BYTES = 50 * 1024 * 1024
  ALLOWED_PHOTO_TYPES = %w[image/jpeg image/png image/webp image/gif].freeze
  belongs_to :exchange_participant
  has_one_attached :photo

  validates :name, presence: true, length: { maximum: 500 }
  validates :description, length: { maximum: 5_000 }, allow_blank: true
  validates :link, length: { maximum: 2_048 }, allow_blank: true
  validates :price, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :link, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]), message: "must be a valid URL" }, allow_blank: true
  validate :acceptable_photo

  delegate :gift_exchange, to: :exchange_participant

  def acceptable_photo
    return unless photo.attached?

    errors.add(:photo, "must be smaller than 5 MB") if photo.blob.byte_size > MAX_PHOTO_BYTES
    errors.add(:photo, "must be a JPEG, PNG, WebP, or GIF") unless ALLOWED_PHOTO_TYPES.include?(photo.blob.content_type)
  end

  def photo_url
    return nil unless photo.attached?
    Rails.application.routes.url_helpers.rails_blob_url(photo, only_path: true)
  end
end
