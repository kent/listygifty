require "test_helper"

class SendDigestJobTest < ActiveSupport::TestCase
  setup do
    @cutoff = Time.current.in_time_zone("America/Toronto").tomorrow.change(hour: 21)
    travel_to @cutoff
    @recipients = [ users(:one), users(:two) ]
    @recipients.each { |user| user.update!(digest_enabled: true, last_digest_sent_at: 1.day.ago) }
    @actor = User.create!(email: "digest-actor@example.com", clerk_user_id: "digest_actor", digest_enabled: false)
    @birthday_collaborator = holidays(:birthday).holiday_users.create!(user: @actor)
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "one digest per member includes their own additions and combines shared lists" do
    holiday_users(:user_one_christmas).update!(gift_notifications: "instant")
    record_change(gifts(:sweater), user: @recipients.first)
    record_change(gifts(:book))

    SendDigestJob.perform_now

    assert_equal 2, ActionMailer::Base.deliveries.size
    digests = ActionMailer::Base.deliveries.index_by { |message| message.to.sole }
    assert_equal @recipients.map(&:email).sort, digests.keys.sort

    combined = digests.fetch(@recipients.first.email)
    assert_equal "🎁 2 new gifts from your shared lists", combined.subject
    assert_includes combined.text_part.decoded, "#{gifts(:sweater).name} [Idea]"
    assert_includes combined.text_part.decoded, "#{gifts(:book).name} [Purchased]"
    assert_includes combined.text_part.decoded, "Added by you"
    assert_includes combined.text_part.decoded, @cutoff.strftime("%A, %B %-d")
    document = Nokogiri::HTML(combined.html_part.decoded)
    assert_equal %w[Idea Purchased], document.css(".gift-status").map(&:text).sort
    item_links = document.css(".gift-name a").to_h { |link| [ link.text, link["href"] ] }
    assert_equal 2, item_links.length
    [ gifts(:sweater), gifts(:book) ].each do |gift|
      url = "https://listygifty.com/holidays/#{gift.holiday_id}?gift=#{gift.id}"
      assert_equal url, item_links.fetch(gift.name)
      assert_includes combined.text_part.decoded, url
    end

    single = digests.fetch(@recipients.last.email)
    assert_equal "🎁 1 new gift from your shared lists", single.subject
    assert_includes single.text_part.decoded, gifts(:sweater).name
    assert_not_includes single.text_part.decoded, gifts(:book).name

    assert_no_difference -> { ActionMailer::Base.deliveries.size } do
      SendDigestJob.perform_now
    end
  end

  test "an addition after the cutoff waits for the next evening even if the job runs late or is rerun" do
    @recipients.last.update!(digest_enabled: false)
    record_change(gifts(:sweater))
    travel 2.minutes
    later_addition = record_change(gifts(:book))

    SendDigestJob.perform_now

    assert_equal @cutoff, @recipients.first.reload.last_digest_sent_at
    assert_not_includes ActionMailer::Base.deliveries.sole.text_part.decoded, gifts(:book).name
    assert_nil later_addition.reload.notified_at
    assert_no_difference -> { ActionMailer::Base.deliveries.size } do
      SendDigestJob.perform_now
    end

    travel 1.day
    assert_difference -> { ActionMailer::Base.deliveries.size }, 1 do
      SendDigestJob.perform_now
    end
    assert_includes ActionMailer::Base.deliveries.last.text_part.decoded, gifts(:book).name
    assert_not_nil later_addition.reload.notified_at
  end

  test "one failed recipient can be retried after another recipient succeeds" do
    record_change(gifts(:sweater))
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

  test "a digest skips additions already covered by an instant email for that recipient" do
    already_emailed = record_change(gifts(:sweater), created_at: 1.hour.ago)
    holiday_users(:user_one_christmas).update!(gift_notifications: "instant", gifts_notified_at: already_emailed.created_at)
    record_change(gifts(:book))

    SendDigestJob.perform_now

    digests = ActionMailer::Base.deliveries.index_by { |message| message.to.sole }
    assert_equal "🎁 1 new gift from your shared lists", digests.fetch(@recipients.first.email).subject
    assert_not_includes digests.fetch(@recipients.first.email).text_part.decoded, gifts(:sweater).name
    assert_includes digests.fetch(@recipients.last.email).text_part.decoded, gifts(:sweater).name
  end

  test "edits to existing gifts do not trigger a digest" do
    record_change(gifts(:sweater), change_type: "updated")

    SendDigestJob.perform_now

    assert_empty ActionMailer::Base.deliveries
  end

  test "lists set to off are left out of the digest" do
    HolidayUser.where(holiday: holidays(:christmas)).update_all(gift_notifications: "off")
    record_change(gifts(:sweater))

    SendDigestJob.perform_now

    assert_empty ActionMailer::Base.deliveries
  end

  test "archived shared lists are left out of the digest" do
    record_change(gifts(:book), user: @recipients.first)
    holidays(:birthday).update!(archived: true)

    SendDigestJob.perform_now

    assert_empty ActionMailer::Base.deliveries
  end

  test "private lists are left out of the digest" do
    @birthday_collaborator.destroy!
    record_change(gifts(:book), user: @recipients.first)

    SendDigestJob.perform_now

    assert_empty ActionMailer::Base.deliveries
  end

  test "a queued instant job leaves additions for the digest" do
    holiday_users(:user_one_christmas).update!(gift_notifications: "instant")
    record_change(gifts(:sweater), created_at: 1.hour.ago)

    SendGiftAddedEmailsJob.perform_now

    assert_empty ActionMailer::Base.deliveries

    SendDigestJob.perform_now
    assert_equal @recipients.map(&:email).sort, ActionMailer::Base.deliveries.flat_map(&:to).sort
  end

  private

  def record_change(gift, **attributes)
    GiftChange.create!({ gift: gift, holiday: gift.holiday, user: @actor, change_type: "created", changes_data: { name: gift.name } }.merge(attributes))
  end
end
