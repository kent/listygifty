require "test_helper"

class SendOrganizerExchangeRemindersJobTest < ActiveSupport::TestCase
  setup do
    travel_to Time.zone.local(2026, 11, 10, 10)
    @organizer = User.create!(email: "organizer@example.com", clerk_user_id: "user_organizer", first_name: "Olive")
    @exchange = GiftExchange.create!(
      workspace: @organizer.ensure_personal_workspace!,
      user: @organizer,
      name: "Family Draw",
      status: "inviting",
      exchange_date: Date.new(2026, 12, 20)
    )
    @exchange.exchange_participants.create!(user: @organizer, name: "Olive", email: @organizer.email, status: "accepted")
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "lists everyone invited who hasn't joined yet" do
    joined("Annabel")
    invited("Bartholomew")
    invited("Cordelia")
    invited("Dorian").decline!

    SendOrganizerExchangeRemindersJob.perform_now

    mail = organizer_mail.sole
    assert_equal "🎁 2 people still need to join: Family Draw", mail.subject
    [ mail.text_part.decoded, mail.html_part.decoded ].each do |body|
      assert_includes body, "Bartholomew"
      assert_includes body, "Cordelia"
      assert_includes body, "2 people are in so far"
      [ "Annabel", "Dorian", "Olive" ].each { |name| assert_not_includes body, name }
    end

    delivery = @organizer.email_deliveries.sent.sole
    assert_equal "organizer_pending_joins", delivery.kind
    assert_equal @exchange.id, delivery.metadata["gift_exchange_id"]
  end

  test "once everyone has joined, reminds the organizer to draw names" do
    joined("Annabel")
    joined("Bartholomew")
    invited("Dorian").decline!

    SendOrganizerExchangeRemindersJob.perform_now

    mail = organizer_mail.sole
    assert_equal "🎁 Everyone's in. Time to draw names: Family Draw", mail.subject
    [ mail.text_part.decoded, mail.html_part.decoded ].each do |body|
      [ "Olive", "Annabel", "Bartholomew" ].each { |name| assert_includes body, name }
      assert_not_includes body, "Dorian"
      assert_includes body, "Sunday, December 20"
      assert_includes body, "/exchanges/#{@exchange.slug}"
    end
    assert_equal "organizer_ready_to_draw", @organizer.email_deliveries.sent.sole.kind
  end

  test "says nothing while too few people are in to draw names" do
    SendOrganizerExchangeRemindersJob.perform_now

    assert_empty organizer_mail
  end

  test "stops once names are drawn, and skips drafts and exchanges whose date has passed" do
    invited("Annabel")
    @exchange.update!(status: "active")
    GiftExchange.create!(workspace: @exchange.workspace, user: @organizer, name: "Draft Draw", status: "draft")
      .then { |draft| invited("Bartholomew", exchange: draft) }
    GiftExchange.create!(
      workspace: @exchange.workspace, user: @organizer, name: "Last Year", status: "inviting",
      exchange_date: Date.new(2026, 11, 1)
    ).then { |past| invited("Cordelia", exchange: past) }

    SendOrganizerExchangeRemindersJob.perform_now

    assert_empty organizer_mail
  end

  test "waits three days between the same reminder for an exchange" do
    invited("Annabel")

    SendOrganizerExchangeRemindersJob.perform_now
    travel 1.day
    SendOrganizerExchangeRemindersJob.perform_now
    assert_equal 1, organizer_mail.length

    travel 2.days
    SendOrganizerExchangeRemindersJob.perform_now
    assert_equal 2, organizer_mail.length
  end

  test "the reminder to draw names goes out the day after the last person joins" do
    annabel = invited("Annabel")
    SendOrganizerExchangeRemindersJob.perform_now

    annabel.accept!(User.create!(email: annabel.email, clerk_user_id: "user_annabel_late", first_name: "Annabel"))
    travel 1.day
    SendOrganizerExchangeRemindersJob.perform_now

    assert_equal [ "🎁 1 person still needs to join: Family Draw", "🎁 Everyone's in. Time to draw names: Family Draw" ],
      organizer_mail.map(&:subject)
  end

  test "a reminder for one exchange does not hold back another" do
    invited("Annabel")
    other = GiftExchange.create!(workspace: @exchange.workspace, user: @organizer, name: "Work Draw", status: "inviting")
    invited("Bartholomew", exchange: other)

    SendOrganizerExchangeRemindersJob.perform_now

    assert_equal [ "Family Draw", "Work Draw" ], organizer_mail.map { |mail| mail.subject.split(": ").last }.sort
  end

  private

  def joined(name, exchange: @exchange)
    email = "#{name.downcase}-#{exchange.id}@example.com"
    user = User.create!(email: email, clerk_user_id: "user_#{name.downcase}_#{exchange.id}", first_name: name)
    exchange.exchange_participants.create!(user: user, name: name, email: email, status: "accepted")
  end

  def invited(name, exchange: @exchange)
    exchange.exchange_participants.create!(name: name, email: "#{name.downcase}-#{exchange.id}@example.com")
  end

  def organizer_mail
    ActionMailer::Base.deliveries.select { |mail| mail.to == [ @organizer.email ] }
  end
end
