class SendGiftAddedEmailsJob < ApplicationJob
  queue_as :default

  # Jobs queued before the switch to the evening digest can finish without sending an email.
  def perform; end
end
