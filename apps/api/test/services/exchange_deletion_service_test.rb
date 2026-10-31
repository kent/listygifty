require "test_helper"

class ExchangeDeletionServiceTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper
  include ActionMailer::TestHelper

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    clear_enqueued_jobs

    owner = User.create!(email: "owner@example.com", clerk_user_id: "user_exchange_owner")
    workspace = owner.ensure_personal_workspace!
    @exchange = GiftExchange.create!(name: "Family Draw", user: owner, workspace: workspace, status: "inviting")
    @exchange.exchange_participants.create!(name: "Relative", email: "relative@example.com")
  end

  teardown do
    clear_enqueued_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
  end

  test "tells participants straight away outside a transaction" do
    assert_enqueued_emails 1 do
      ExchangeDeletionService.delete!(@exchange)
    end
  end

  test "waits for an enclosing transaction to commit" do
    GiftExchange.transaction do
      ExchangeDeletionService.delete!(@exchange)
      assert_no_enqueued_emails
    end

    assert_enqueued_emails 1
  end

  test "says nothing when the enclosing transaction rolls back" do
    assert_no_enqueued_emails do
      GiftExchange.transaction do
        ExchangeDeletionService.delete!(@exchange)
        raise ActiveRecord::Rollback
      end
    end

    assert GiftExchange.exists?(@exchange.id)
  end
end
