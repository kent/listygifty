# One stored picture, for gifts and wishlist items. Uploads and assistant
# photos land here; Photos::Intake converts other formats to these first.
module HasPhoto
  extend ActiveSupport::Concern

  MAX_PHOTO_BYTES = 5 * 1024 * 1024
  ALLOWED_PHOTO_TYPES = %w[image/jpeg image/png image/webp image/gif].freeze

  included do
    has_one_attached :photo
    validate :acceptable_photo
  end

  # The bucket is private, so pictures stream through the API instead of
  # redirecting to a signed storage URL. The link never expires; deleting the
  # photo is what revokes it.
  def photo_url
    return unless photo.attached?

    helpers = Rails.application.routes.url_helpers
    options = ActiveStorage::Current.url_options
    options ? helpers.rails_storage_proxy_url(photo, **options) : helpers.rails_storage_proxy_path(photo)
  end

  private

  def acceptable_photo
    return unless photo.attached?

    errors.add(:photo, "must be smaller than 5 MB") if photo.blob.byte_size > MAX_PHOTO_BYTES
    errors.add(:photo, "must be a JPEG, PNG, WebP, or GIF") unless ALLOWED_PHOTO_TYPES.include?(photo.blob.content_type)
  end
end
