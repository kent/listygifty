require "test_helper"

class ActiveStorageCleanupJobTest < ActiveJob::TestCase
  test "purges only unattached blobs older than the retention window" do
    old = blob("old.png", 2.days.ago)
    recent = blob("recent.png", 1.hour.ago)
    attached = blob("attached.png", 2.days.ago)
    person = people(:mom)
    ActiveStorage::Attachment.create!(name: "test", record: person, blob: attached)

    perform_enqueued_jobs { ActiveStorageCleanupJob.perform_now }

    assert_not ActiveStorage::Blob.exists?(old.id)
    assert ActiveStorage::Blob.exists?(recent.id)
    assert ActiveStorage::Blob.exists?(attached.id)
  end

  private

  def blob(filename, created_at)
    ActiveStorage::Blob.create_and_upload!(
      io: StringIO.new("png"),
      filename: filename,
      content_type: "image/png"
    ).tap { |record| record.update_column(:created_at, created_at) }
  end
end
