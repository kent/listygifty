# Gives a gift or wishlist item the main picture from its product link. It
# runs in the background so the tool call that set the link stays quick, and
# gives up quietly: the item is fine without a photo.
class LinkPhotoJob < ApplicationJob
  queue_as :default
  discard_on ActiveJob::DeserializationError

  # replacing_blob_id is the photo the item had when this was queued. The job
  # only acts while that is still its photo and the link is unchanged, so a
  # photo or link set in the meantime wins.
  def perform(record, link, user, replacing_blob_id = nil)
    return unless current?(record, link, replacing_blob_id)

    photo = Photos::LinkImage.call(link)
    return unless photo

    user.with_lock do
      record.reload
      next unless current?(record, link, replacing_blob_id)

      Photos.assign(record, photo, user: user)
      record.save!
    end
  rescue Photos::Invalid => e
    Rails.logger.info("LinkPhotoJob skipped #{record.class.name}##{record.id}: #{e.message}")
  end

  private

  def current?(record, link, replacing_blob_id)
    record.product_link == link && record.photo.attachment&.blob_id == replacing_blob_id
  end
end
