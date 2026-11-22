module Photos
  # Messages are written for the person who sent the photo.
  Invalid = Class.new(ArgumentError)

  REMOVE = :remove
  # The record's image_url, set in the same save, is its picture now.
  LINK_ONLY = :link_only

  # Stages a new photo (an Active Storage attachable), REMOVE, or LINK_ONLY on
  # record for its next save. Call it inside user.with_lock so two uploads
  # can't both fit under the quota.
  def self.assign(record, photo, user:)
    if photo == REMOVE || photo == LINK_ONLY
      record.photo = nil
    else
      Quota.ensure_room!(user, record, photo.fetch(:io).size)
      record.photo = photo
    end
    # An old outside link would otherwise show through once the photo is gone.
    record.image_url = nil if record.has_attribute?(:image_url) && photo != LINK_ONLY
  end

  def self.human_size(bytes)
    ActiveSupport::NumberHelper.number_to_human_size(bytes)
  end
end
