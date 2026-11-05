require "test_helper"

class DemoAccountTest < ActiveSupport::TestCase
  FakeClerk = Struct.new(:existing_ids, :created, :tickets) do
    def users = self
    def sign_in_tokens = self

    def list(request:)
      Struct.new(:user_list).new(existing_ids.map { |id| Struct.new(:id).new(id) })
    end

    def create(request:)
      if request.is_a?(Clerk::Models::Operations::CreateSignInTokenRequest)
        tickets << request
        Struct.new(:sign_in_token).new(Struct.new(:token).new("ticket-#{tickets.length}"))
      else
        created << request
        Struct.new(:user).new(Struct.new(:id).new("user_demo_created"))
      end
    end
  end

  setup do
    travel_to Time.zone.local(2026, 11, 10, 9)
    @clerk = FakeClerk.new([], [], [])
  end

  test "creates the demo account with sample data and returns a short-lived sign-in ticket" do
    ticket = DemoAccount.new(clerk: @clerk).sign_in_ticket!

    assert_equal "ticket-1", ticket
    assert_equal [ [ DemoAccount::EMAIL ] ], @clerk.created.map(&:email_address)
    assert_equal 600, @clerk.tickets.sole.expires_in_seconds
    user = User.find_by!(email: DemoAccount::EMAIL)
    assert_equal "user_demo_created", @clerk.tickets.sole.user_id
    assert_equal "user_demo_created", user.clerk_user_id

    workspace = user.personal_workspace
    assert_equal [ "Holiday Wishlist", "My Birthday Wishlist" ], workspace.wishlists.pluck(:name).sort
    assert_equal 3, workspace.wishlists.find_by!(name: "My Birthday Wishlist").wishlist_items.count
    assert_equal [ "Christmas 2026", "Mom's Birthday" ], workspace.holidays.pluck(:name).sort
    assert_equal 3, workspace.people.count
    exchange = workspace.gift_exchanges.sole
    assert_equal "active", exchange.status
    assert_equal "Alex Parker", exchange.participant_for(user).matched_participant.name
  end

  test "reuses the Clerk user that already has the demo email" do
    @clerk.existing_ids << "user_demo_existing"

    DemoAccount.new(clerk: @clerk).sign_in_ticket!

    assert_empty @clerk.created
    assert_equal "user_demo_existing", User.find_by!(email: DemoAccount::EMAIL).clerk_user_id
  end

  test "keeps a reviewer's changes for an hour, then resets the sample data" do
    demo = DemoAccount.new(clerk: @clerk)
    demo.sign_in_ticket!
    wishlist = Wishlist.find_by!(name: "My Birthday Wishlist")
    wishlist.wishlist_items.create!(name: "Added by a reviewer", quantity: 1, position: 3)

    travel 30.minutes
    demo.sign_in_ticket!
    assert_includes wishlist.reload.wishlist_items.pluck(:name), "Added by a reviewer"

    travel 31.minutes
    demo.sign_in_ticket!
    assert_not Wishlist.exists?(wishlist.id)
    fresh = Wishlist.find_by!(name: "My Birthday Wishlist")
    assert_not_includes fresh.wishlist_items.pluck(:name), "Added by a reviewer"
    assert_equal 1, User.where(email: DemoAccount::EMAIL).count
  end

  test "matches the demo email however it is typed" do
    assert DemoAccount.email?("  Demo@ListyGifty.com ")
    assert_not DemoAccount.email?("demo@listygifty.com.evil.test")
    assert_not DemoAccount.email?(nil)
  end

  test "mail never reaches the demo account" do
    both = ActionMailer::Base.mail(from: "hello@listygifty.com", to: [ DemoAccount::EMAIL, "friend@example.com" ], subject: "Hi", body: "Hi")
    DemoMailInterceptor.delivering_email(both)
    assert_equal [ "friend@example.com" ], both.to
    assert both.perform_deliveries

    only_demo = ActionMailer::Base.mail(from: "hello@listygifty.com", to: DemoAccount::EMAIL, subject: "Hi", body: "Hi")
    DemoMailInterceptor.delivering_email(only_demo)
    assert_not only_demo.perform_deliveries
  end
end
