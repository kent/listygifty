require "test_helper"

class SendWishlistRemindersJobTest < ActiveSupport::TestCase
  setup do
    travel_to Time.zone.local(2026, 11, 10, 11)
    @organizer = User.create!(email: "organizer@example.com", clerk_user_id: "user_organizer", first_name: "Olive")
    @exchange = GiftExchange.create!(
      workspace: @organizer.ensure_personal_workspace!,
      user: @organizer,
      name: "Family Draw",
      status: "inviting",
      exchange_date: Date.new(2026, 12, 20)
    )
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    ActionMailer::Base.deliveries.clear
  end

  test "reminds someone who joined two days ago and has no ideas" do
    annabel = joined("Annabel", days_ago: 2)
    joined("Bartholomew", days_ago: 2).exchange_wishlist_items.create!(name: "Wool socks")
    joined("Cordelia", days_ago: 1)
    @exchange.exchange_participants.create!(name: "Dorian", email: "dorian@example.com", created_at: 5.days.ago)

    SendWishlistRemindersJob.perform_now

    mail = ActionMailer::Base.deliveries.sole
    assert_equal [ annabel.email ], mail.to
    assert_equal "💡 What would you like? Add gift ideas for Family Draw", mail.subject
    [ mail.text_part.decoded, mail.html_part.decoded ].each do |body|
      assert_includes body, "Whoever draws your name"
      assert_includes body, "Sunday, December 20"
      assert_includes body, "/exchanges/#{@exchange.slug}/my-wishlist"
    end

    delivery = annabel.user.email_deliveries.sent.sole
    assert_equal "exchange_wishlist_reminder", delivery.kind
    assert_equal annabel.id, delivery.metadata["participant_id"]
  end

  test "after the draw it says their Secret Santa has their name" do
    joined("Annabel", days_ago: 3)
    @exchange.update!(status: "active")

    SendWishlistRemindersJob.perform_now

    assert_includes ActionMailer::Base.deliveries.sole.text_part.decoded, "Your Secret Santa has your name"
  end

  test "sends a last call in the two weeks before the exchange, and never a third" do
    joined("Annabel", days_ago: 2)

    SendWishlistRemindersJob.perform_now
    assert_equal 1, ActionMailer::Base.deliveries.length

    travel_to Time.zone.local(2026, 12, 5, 11)
    SendWishlistRemindersJob.perform_now
    assert_equal 1, ActionMailer::Base.deliveries.length, "a month out is too early for the last call"

    travel_to Time.zone.local(2026, 12, 6, 11)
    SendWishlistRemindersJob.perform_now
    assert_equal 2, ActionMailer::Base.deliveries.length

    travel_to Time.zone.local(2026, 12, 19, 11)
    SendWishlistRemindersJob.perform_now
    assert_equal 2, ActionMailer::Base.deliveries.length
  end

  test "waits a week after the first reminder even when the exchange is close" do
    @exchange.update!(exchange_date: Date.new(2026, 11, 20))
    joined("Annabel", days_ago: 2)

    SendWishlistRemindersJob.perform_now
    travel 6.days
    SendWishlistRemindersJob.perform_now
    assert_equal 1, ActionMailer::Base.deliveries.length

    travel 1.day
    SendWishlistRemindersJob.perform_now
    assert_equal 2, ActionMailer::Base.deliveries.length
  end

  test "an exchange with no date only gets the first reminder" do
    @exchange.update!(exchange_date: nil)
    joined("Annabel", days_ago: 2)

    SendWishlistRemindersJob.perform_now
    travel 30.days
    SendWishlistRemindersJob.perform_now

    assert_equal 1, ActionMailer::Base.deliveries.length
  end

  test "stops once they add an idea" do
    annabel = joined("Annabel", days_ago: 2)
    SendWishlistRemindersJob.perform_now
    annabel.exchange_wishlist_items.create!(name: "A good book")

    travel_to Time.zone.local(2026, 12, 10, 11)
    SendWishlistRemindersJob.perform_now

    assert_equal 1, ActionMailer::Base.deliveries.length
  end

  test "holds off when their Secret Santa just nudged them" do
    annabel = joined("Annabel", days_ago: 5)
    @exchange.update!(status: "active")
    @exchange.exchange_notifications.create!(recipient_participant: annabel, kind: "wishlist_nudge", created_at: 2.days.ago)

    SendWishlistRemindersJob.perform_now
    assert_empty ActionMailer::Base.deliveries

    travel 2.days
    SendWishlistRemindersJob.perform_now
    assert_equal 1, ActionMailer::Base.deliveries.length
  end

  test "skips drafts, completed exchanges, and exchanges whose date has passed" do
    joined("Annabel", days_ago: 2)
    @exchange.update!(status: "completed")
    draft = GiftExchange.create!(workspace: @exchange.workspace, user: @organizer, name: "Draft", status: "draft")
    joined("Bartholomew", days_ago: 2, exchange: draft)
    past = GiftExchange.create!(
      workspace: @exchange.workspace, user: @organizer, name: "Last Year", status: "active",
      exchange_date: Date.new(2026, 11, 1)
    )
    joined("Cordelia", days_ago: 2, exchange: past)

    SendWishlistRemindersJob.perform_now

    assert_empty ActionMailer::Base.deliveries
  end

  private

  def joined(name, days_ago:, exchange: @exchange)
    email = "#{name.downcase}-#{exchange.id}@example.com"
    user = User.create!(email: email, clerk_user_id: "user_#{name.downcase}_#{exchange.id}", first_name: name)
    exchange.exchange_participants.create!(
      user: user, name: name, email: email, status: "accepted", created_at: days_ago.days.ago
    )
  end
end
