class ActiveStorageCleanupJob < ApplicationJob
  queue_as :background

  UNATTACHED_RETENTION = 24.hours

  def perform
    ActiveStorage::Blob.unattached
      .where(created_at: ...UNATTACHED_RETENTION.ago)
      .find_each(&:purge_later)
  end
end
