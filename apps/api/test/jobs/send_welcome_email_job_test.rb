require "test_helper"

class SendWelcomeEmailJobTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @user.update!(welcomed_at: nil)
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "welcome is delivered before marking the user welcomed and repeats are skipped" do
    SendWelcomeEmailJob.perform_now(@user.id)
    assert_equal [ @user.email ], ActionMailer::Base.deliveries.flat_map(&:to)
    assert_not_nil @user.reload.welcomed_at
    SendWelcomeEmailJob.perform_now(@user.id)
    assert_equal 1, ActionMailer::Base.deliveries.length
  end

  test "a failed welcome remains eligible for retry" do
    interceptor = Object.new
    interceptor.define_singleton_method(:delivering_email) { |_message| raise "Simulated delivery failure" }
    ActionMailer::Base.register_interceptor(interceptor)
    assert_raises(RuntimeError) { SendWelcomeEmailJob.perform_now(@user.id) }
    assert_nil @user.reload.welcomed_at
    ActionMailer::Base.unregister_interceptor(interceptor)
    SendWelcomeEmailJob.perform_now(@user.id)
    assert_equal 1, ActionMailer::Base.deliveries.length
  ensure
    ActionMailer::Base.unregister_interceptor(interceptor) if interceptor
  end

  test "a joined holiday produces the invitation welcome" do
    SendWelcomeEmailJob.perform_now(@user.id, holiday_id: holidays(:christmas).id)
    assert_includes ActionMailer::Base.deliveries.first.subject, "You've joined"
  end
end
