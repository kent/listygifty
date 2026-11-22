module Photos
  # Messages are written for the person who sent the photo.
  Invalid = Class.new(ArgumentError)

  REMOVE = :remove

  # Stages a new photo (an Active Storage attachable) or REMOVE on record for
  # its next save. Call it inside user.with_lock so two uploads can't both fit
  # under the quota.
  def self.assign(record, photo, user:)
    if photo == REMOVE
      record.photo = nil
    else
      Quota.ensure_room!(user, record, photo.fetch(:io).size)
      record.photo = photo
    end
    # An old outside link would otherwise show through once the photo is gone.
    record.image_url = nil if record.has_attribute?(:image_url)
  end

  def self.human_size(bytes)
    ActiveSupport::NumberHelper.number_to_human_size(bytes)
  end
end
