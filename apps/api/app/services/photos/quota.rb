module Photos
  # The photo storage one account can fill: photos on its own wishlists and on
  # every Gift List it belongs to. A shared Gift List counts in full for each
  # member, so sharing a list can't stretch it past the limit.
  module Quota
    LIMIT = 1024 * 1024 * 1024

    module_function

    def room_for?(user, record, bytes)
      used_bytes(user, except: record) + bytes <= LIMIT
    end

    def ensure_room!(user, record, bytes)
      used = used_bytes(user, except: record)
      return if used + bytes <= LIMIT

      raise Invalid, "Photo storage is full: your wishlists and Gift Lists already hold #{Photos.human_size(used)} " \
        "of the #{Photos.human_size(LIMIT)} limit. Remove some photos, or send a smaller one."
    end

    # Bytes stored, leaving out the photo `except` already has, since a new
    # one would replace it.
    def used_bytes(user, except: nil)
      scope = attachments(user)
      scope = scope.where.not(record_type: except.class.polymorphic_name, record_id: except.id) if except&.persisted?
      scope.sum("active_storage_blobs.byte_size")
    end

    def attachments(user)
      item_ids = WishlistItem.joins(:wishlist).where(wishlists: { user_id: user.id }).select(:id)
      gift_ids = Gift.where(holiday_id: HolidayUser.where(user_id: user.id).select(:holiday_id)).select(:id)
      photos = ActiveStorage::Attachment.where(name: "photo")
      photos.where(record_type: WishlistItem.polymorphic_name, record_id: item_ids)
        .or(photos.where(record_type: Gift.polymorphic_name, record_id: gift_ids))
        .joins(:blob)
    end
  end
end
