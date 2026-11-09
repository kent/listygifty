# A shared sample-data account for app directory reviewers, such as OpenAI's.
#
# Entering its email on the web sign-in page signs straight in with no code
# or password. Because anyone with the email can get in, the account is fenced:
# it never sends or receives email (DemoMailInterceptor), it can only use the
# apps MCP tool set, the website is read-only for it, and its sample data
# resets when someone signs in after it has sat for a while.
class DemoAccount
  EMAIL = "demo@listygifty.com"
  FIRST_NAME = "Demo"
  LAST_NAME = "Reviewer"
  RESET_AFTER = 1.hour
  TICKET_LIFETIME = 10.minutes
  WISHLIST_NAME = "My Birthday Wishlist"
  ALEX_EMAIL = "alex.parker@example.com".freeze

  def self.email?(value)
    value.is_a?(String) && value.strip.casecmp?(EMAIL)
  end

  def self.user?(user)
    email?(user&.email)
  end

  def initialize(clerk: Clerk::SDK.new)
    @clerk = clerk
  end

  # A one-time Clerk sign-in token. The browser trades it for a session with
  # the ticket strategy, so no email code is sent.
  def sign_in_ticket!
    user = ensure_user!
    reset!(user) if stale?(user)

    response = @clerk.sign_in_tokens.create(
      request: Clerk::Models::Operations::CreateSignInTokenRequest.new(
        user_id: user.clerk_user_id,
        expires_in_seconds: TICKET_LIFETIME.to_i
      )
    )
    response.sign_in_token&.token || raise("Clerk did not return a sign-in token")
  end

  def ensure_user!
    user = User.find_by("LOWER(email) = ?", EMAIL)
    clerk_user_id = user&.clerk_user_id.presence || find_or_create_clerk_user_id
    user ||= User.find_or_initialize_by(clerk_user_id: clerk_user_id)
    user.assign_attributes(
      clerk_user_id: clerk_user_id, email: EMAIL, first_name: FIRST_NAME, last_name: LAST_NAME,
      clerk_profile_synced_at: Time.current
    )
    user.subscription_plan ||= "free"
    user.save!
    user.ensure_personal_workspace!
    user
  end

  def stale?(user)
    sample = Wishlist.find_by(user: user, workspace: user.personal_workspace, name: WISHLIST_NAME)
    sample.nil? || sample.created_at < RESET_AFTER.ago
  end

  # Replaces everything in the demo workspace with fresh sample data.
  def reset!(user)
    workspace = user.ensure_personal_workspace!

    ActiveRecord::Base.transaction do
      workspace.gift_exchanges.destroy_all
      workspace.wishlists.destroy_all
      workspace.holidays.destroy_all
      workspace.people.destroy_all
      seed!(user, workspace)
    end
  end

  private

  def find_or_create_clerk_user_id
    existing = @clerk.users.list(
      request: Clerk::Models::Operations::GetUserListRequest.new(email_address: [ EMAIL ])
    ).user_list&.first
    return existing.id if existing

    @clerk.users.create(
      request: Clerk::Models::Operations::CreateUserRequest.new(
        email_address: [ EMAIL ], first_name: FIRST_NAME, last_name: LAST_NAME, skip_password_requirement: true
      )
    ).user.id
  end

  def seed!(user, workspace)
    people = {
      mom: workspace.people.create!(user: user, name: "Nina Rivera", relationship: "Mom",
        notes: "Loves gardening, mystery novels, and good tea."),
      alex: workspace.people.create!(user: user, name: "Alex Parker", relationship: "Partner",
        notes: "Into running, coffee, and anything for the desk."),
      sam: workspace.people.create!(user: user, name: "Sam Lee", relationship: "Friend",
        notes: "Board game night host. Cozy home stuff is always a hit.")
    }
    seed_gift_lists(user, workspace, people)
    seed_wishlists(user, workspace)
    seed_exchange(user, workspace)
  end

  def seed_gift_lists(user, workspace, people)
    statuses = GiftStatus.by_position.index_by(&:name)
    {
      [ "Christmas 2026", Date.new(2026, 12, 25), "tree-pine" ] => [
        [ "Mystery novel box set", :mom, "Idea", 45, "https://example.com/mystery-box-set" ],
        [ "Trail running socks", :alex, "Purchased", 24, "https://example.com/running-socks" ],
        [ "Cooperative board game", :sam, "Idea", 39, "https://example.com/board-game" ]
      ],
      [ "Mom's Birthday", Date.new(2027, 3, 14), "cake" ] => [
        [ "Herb garden starter kit", :mom, "Idea", 35, "https://example.com/herb-garden" ]
      ]
    }.each do |(name, date, icon), gifts|
      holiday = workspace.holidays.create!(name: name, date: date, icon: icon, is_template: false)
      HolidayUser.create!(holiday: holiday, user: user, role: "owner")
      gifts.each do |gift_name, recipient, status, cost, link|
        gift = holiday.gifts.create!(name: gift_name, cost: cost, link: link, gift_status: statuses.fetch(status), created_by: user)
        GiftRecipient.create!(gift: gift, person: people.fetch(recipient))
      end
    end
  end

  def seed_wishlists(user, workspace)
    birthday = workspace.wishlists.create!(user: user, name: WISHLIST_NAME, visibility: "private",
      description: "Ideas for my birthday in March.", target_date: Date.new(2027, 3, 2))
    [
      [ "Pour-over coffee kettle", "https://example.com/coffee-kettle", 40, 60, :most_wanted ],
      [ "Hardcover sketchbook", "https://example.com/sketchbook", 15, 25, :normal ],
      [ "Wool beanie, charcoal", "https://example.com/beanie", 20, 35, :high ]
    ].each_with_index do |(name, url, price_min, price_max, priority), position|
      birthday.wishlist_items.create!(name: name, url: url, price_min: price_min, price_max: price_max,
        priority: WishlistItem::PRIORITIES.fetch(priority), quantity: 1, position: position)
    end

    workspace.wishlists.create!(user: user, name: "Holiday Wishlist", visibility: "private",
      description: "Things I'd love this holiday season.")
      .wishlist_items.create!(name: "Cozy reading lamp", url: "https://example.com/reading-lamp",
        price_min: 30, price_max: 50, priority: WishlistItem::PRIORITIES.fetch(:normal), quantity: 1, position: 0)
  end

  # Names are already drawn, so the reviewer has a match and an exchange
  # wishlist. Other participants use example.com addresses, which the mail
  # interceptor never sends to.
  def seed_exchange(user, workspace)
    exchange = workspace.gift_exchanges.create!(user: user, name: "Family Secret Santa", status: "active",
      exchange_date: Date.new(2026, 12, 20), budget_min: 25, budget_max: 50)
    participants = {
      demo: exchange.exchange_participants.create!(user: user, name: "#{FIRST_NAME} #{LAST_NAME}", email: EMAIL, status: "accepted"),
      alex: exchange.exchange_participants.create!(name: "Alex Parker", email: ALEX_EMAIL, status: "accepted"),
      sam: exchange.exchange_participants.create!(name: "Sam Lee", email: "sam.lee@example.com", status: "accepted"),
      nina: exchange.exchange_participants.create!(name: "Nina Rivera", email: "nina.rivera@example.com", status: "accepted")
    }
    { demo: :alex, alex: :nina, nina: :sam, sam: :demo }.each do |giver, receiver|
      participants.fetch(giver).update!(matched_participant: participants.fetch(receiver))
    end
    demo = participants.fetch(:demo)
    demo.update!(wishlist: workspace.wishlists.find_by!(user: user, name: "Holiday Wishlist"))
    demo.wishlist.wishlist_items.create!(name: "Coffee subscription", price_min: 35, price_max: 35,
      notes: "Light roast, whole bean.", url: "https://example.com/coffee-subscription")

    # Alex needs an account to own a wishlist. It never signs in, and its list
    # lives in the demo workspace, private, so a reset clears it with the rest.
    alex = participants.fetch(:alex)
    alex_user = User.find_or_create_by!(email: ALEX_EMAIL) do |placeholder|
      placeholder.clerk_user_id = "demo_alex_parker"
      placeholder.first_name = "Alex"
      placeholder.last_name = "Parker"
    end
    alex_list = workspace.wishlists.create!(user: alex_user, name: Wishlist::DEFAULT_NAME, visibility: "private")
    alex_list.wishlist_items.create!(name: "Desk plant", price_min: 28, price_max: 28,
      notes: "Something hard to kill.", url: "https://example.com/desk-plant")
    alex.update!(user: alex_user, wishlist: alex_list)
  end
end
