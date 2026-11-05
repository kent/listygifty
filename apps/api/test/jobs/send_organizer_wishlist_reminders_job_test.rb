require "test_helper"

class SendOrganizerWishlistRemindersJobTest < ActiveSupport::TestCase
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
    @organizer_row = @exchange.exchange_participants.create!(
      user: @organizer, name: "Olive", email: @organizer.email, status: "accepted"
    )
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "lists everyone who joined without adding an idea" do
    annabel = joined("Annabel")
    bartholomew = joined("Bartholomew")
    with_idea = joined("Cordelia")
    with_idea.exchange_wishlist_items.create!(name: "Wool socks")
    @exchange.exchange_participants.create!(name: "Still invited", email: "invited@example.com")

    SendOrganizerWishlistRemindersJob.perform_now

    assert_equal 1, organizer_mail.length
    mail = organizer_mail.first
    assert_equal "🎁 2 people still need to add gift ideas: Family Draw", mail.subject
    [ mail.text_part.decoded, mail.html_part.decoded ].each do |body|
      assert_includes body, annabel.display_name
      assert_includes body, bartholomew.display_name
      assert_not_includes body, "Cordelia"
      assert_not_includes body, "Still invited"
      assert_not_includes body, "Olive"
    end

    delivery = @organizer.email_deliveries.sent.sole
    assert_equal "organizer_wishlist_reminder", delivery.kind
    assert_equal @exchange.id, delivery.metadata["gift_exchange_id"]
  end

  test "keeps reminding after names are drawn" do
    joined("Annabel")
    @exchange.update!(status: "active")

    SendOrganizerWishlistRemindersJob.perform_now

    assert_equal "🎁 1 person still needs to add gift ideas: Family Draw", organizer_mail.sole.subject
  end

  test "sends nothing once everyone has an idea, even if the organizer has none" do
    joined("Annabel").exchange_wishlist_items.create!(name: "A good book")

    SendOrganizerWishlistRemindersJob.perform_now

    assert_empty organizer_mail
  end

  test "waits three days between reminders for the same exchange" do
    joined("Annabel")

    SendOrganizerWishlistRemindersJob.perform_now
    travel 1.day
    SendOrganizerWishlistRemindersJob.perform_now
    assert_equal 1, organizer_mail.length

    travel 2.days
    SendOrganizerWishlistRemindersJob.perform_now
    assert_equal 2, organizer_mail.length
  end

  test "a reminder for one exchange does not hold back another" do
    joined("Annabel")
    other = GiftExchange.create!(workspace: @exchange.workspace, user: @organizer, name: "Work Draw", status: "inviting")
    joined("Bartholomew", exchange: other)

    SendOrganizerWishlistRemindersJob.perform_now

    assert_equal [ "Family Draw", "Work Draw" ], organizer_mail.map { |mail| mail.subject.split(": ").last }.sort
  end

  test "skips drafts, completed exchanges, and exchanges whose date has passed" do
    joined("Annabel")
    @exchange.update!(status: "completed")
    past = GiftExchange.create!(
      workspace: @exchange.workspace, user: @organizer, name: "Last Year", status: "active",
      exchange_date: Date.new(2026, 11, 1)
    )
    joined("Bartholomew", exchange: past)

    SendOrganizerWishlistRemindersJob.perform_now

    assert_empty organizer_mail
  end

  private

  def joined(name, exchange: @exchange)
    email = "#{name.downcase}-#{exchange.id}@example.com"
    user = User.create!(email: email, clerk_user_id: "user_#{name.downcase}_#{exchange.id}", first_name: name)
    exchange.exchange_participants.create!(user: user, name: name, email: email, status: "accepted")
  end

  def organizer_mail
    ActionMailer::Base.deliveries.select { |mail| mail.to == [ @organizer.email ] }
  end
end
