require "test_helper"

class SendDigestJobTest < ActiveSupport::TestCase
  setup do
    @recipients = [ users(:one), users(:two) ]
    @recipients.each { |user| user.update!(digest_enabled: true, last_digest_sent_at: 1.day.ago) }
    @actor = User.create!(email: "digest-actor@example.com", clerk_user_id: "digest_actor", digest_enabled: false)
    GiftChange.create!(gift: gifts(:sweater), holiday: holidays(:christmas), user: @actor,
      change_type: "updated", changes_data: { name: [ "Old gift", "New gift" ] })
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "every eligible collaborator receives a change and reruns do not resend it" do
    SendDigestJob.perform_now
    assert_equal @recipients.map(&:email).sort, ActionMailer::Base.deliveries.flat_map(&:to).sort

    ActionMailer::Base.deliveries.clear
    SendDigestJob.perform_now
    assert_empty ActionMailer::Base.deliveries
  end

  test "one failed recipient can be retried after another recipient succeeds" do
    failed_email = @recipients.first.email
    interceptor = Object.new
    interceptor.define_singleton_method(:delivering_email) do |message|
      raise "Simulated delivery failure" if message.to.include?(failed_email)
    end
    ActionMailer::Base.register_interceptor(interceptor)
    SendDigestJob.perform_now
    assert_equal [ @recipients.last.email ], ActionMailer::Base.deliveries.flat_map(&:to)

    ActionMailer::Base.unregister_interceptor(interceptor)
    ActionMailer::Base.deliveries.clear
    SendDigestJob.perform_now
    assert_equal [ failed_email ], ActionMailer::Base.deliveries.flat_map(&:to)
  ensure
    ActionMailer::Base.unregister_interceptor(interceptor) if interceptor
  end

  test "changes arriving during delivery remain available for the next digest" do
    @recipients.last.update!(digest_enabled: false)
    cutoff = 1.minute.from_now.change(usec: 0)
    travel_to cutoff
    incoming = nil
    interceptor = Object.new
    advance_time = -> { travel 2.seconds }
    actor = @actor
    gift = gifts(:sweater)
    interceptor.define_singleton_method(:delivering_email) do |_message|
      advance_time.call
      incoming = GiftChange.create!(gift: gift, holiday: gift.holiday, user: actor,
        change_type: "updated", changes_data: { name: [ "New gift", "Changed during delivery" ] })
    end
    ActionMailer::Base.register_interceptor(interceptor)
    SendDigestJob.perform_now
    assert_equal cutoff, @recipients.first.reload.last_digest_sent_at
    assert_nil incoming.reload.notified_at

    ActionMailer::Base.unregister_interceptor(interceptor)
    ActionMailer::Base.deliveries.clear
    SendDigestJob.perform_now
    assert_equal 1, ActionMailer::Base.deliveries.length
    assert_not_nil incoming.reload.notified_at
  ensure
    ActionMailer::Base.unregister_interceptor(interceptor) if interceptor
  end
end
