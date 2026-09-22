require "test_helper"
require "minitest/mock"
require_relative "../support/database_lock_assertions"

class NotificationConcurrencyTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  include DatabaseLockAssertions

  setup do
    skip "Row-lock regression requires PostgreSQL" unless ActiveRecord::Base.connection.adapter_name == "PostgreSQL"
    travel_to Time.zone.local(2026, 12, 10, 9)
    suffix = SecureRandom.hex(8)
    @user = User.create!(email: "notification-#{suffix}@example.com", clerk_user_id: "notification_#{suffix}")
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    @user&.destroy!
    ActionMailer::Base.deliveries.clear
  end

  test "welcome jobs recheck the delivered marker after waiting for the user lock" do
    welcomed_at = 1.day.ago
    assert_waiting_mutation(@user, -> { SendWelcomeEmailJob.perform_now(@user.id) }) do
      @user.update!(welcomed_at: welcomed_at)
    end
    assert_equal welcomed_at, @user.reload.welcomed_at
    assert_empty ActionMailer::Base.deliveries
  end

  test "reminder jobs recheck cadence after waiting for another run" do
    User.stub(:find_each, ->(&block) { block.call(User.find(@user.id)) }) do
      assert_waiting_mutation(@user, -> { SendSeasonalRemindersJob.perform_now }) do
        EmailDelivery.log_sent!(user: @user, kind: "no_gift_lists_december", subject: "Already sent", dedupe_key: "competing-run")
      end
    end
    assert_empty ActionMailer::Base.deliveries.select { |mail| mail.to.include?(@user.email) }
    assert_equal 1, @user.email_deliveries.sent.count
  end

  test "concurrent preference creation returns the same persisted record" do
    current = nil
    waiting = nil
    assert_waiting_mutation(@user, -> { waiting = User.find(@user.id).notification_prefs }) do
      current = @user.notification_prefs
    end
    assert_equal current.id, waiting.id
    assert_equal 1, NotificationPreference.where(user: @user).count
  end
end
