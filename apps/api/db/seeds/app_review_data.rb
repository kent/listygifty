# App review seed data for staging/production reviewer flows.
# Creates a predictable reviewer account and sample records.

module AppReviewSeedData
  module_function

  REVIEWER_EMAIL = "marie@gifts.com"
  REVIEWER_PASSWORD = "password123"
  REVIEWER_FIRST_NAME = "Marie"
  REVIEWER_LAST_NAME = "Reviewer"
  REVIEWER_FALLBACK_CLERK_ID = "seed_marie_gifts_com"

  PEOPLE = [
    {
      key: :alex,
      name: "Alex Parker",
      email: "alex.parker@gifts.com",
      relationship: "Partner",
      notes: "Likes practical gifts and gadgets."
    },
    {
      key: :sam,
      name: "Sam Lee",
      email: "sam.lee@gifts.com",
      relationship: "Friend",
      notes: "Enjoys cozy and home items."
    },
    {
      key: :nina,
      name: "Nina Rivera",
      email: "nina.rivera@gifts.com",
      relationship: "Mom",
      notes: "Prefers experiences and books."
    }
  ].freeze

  HOLIDAYS = [
    { key: :birthday_2026, name: "App Review Birthday 2026", date: Date.new(2026, 6, 12), icon: "cake" },
    { key: :mothers_day_2026, name: "App Review Mother's Day 2026", date: Date.new(2026, 5, 10), icon: "heart-handshake" },
    { key: :christmas_2026, name: "App Review Christmas 2026", date: Date.new(2026, 12, 25), icon: "gift" }
  ].freeze

  GIFTS = {
    birthday_2026: [
      {
        name: "Wireless Earbuds",
        status: "Purchased",
        recipient: :sam,
        giver: :alex,
        cost: 89.99,
        link: "https://example.com/wireless-earbuds",
        description: "Noise-canceling earbuds for daily commuting."
      },
      {
        name: "Personalized Birthday Card",
        status: "Done",
        recipient: :sam,
        giver: :nina,
        cost: 12.50,
        link: nil,
        description: "Custom card with printed family photos."
      },
      {
        name: "Family Cookbook",
        status: "Idea",
        recipient: :nina,
        giver: :alex,
        cost: 24.95,
        link: "https://example.com/family-cookbook",
        description: "Hardcover cookbook with blank recipe pages."
      }
    ],
    mothers_day_2026: [
      {
        name: "Flower Delivery Subscription",
        status: "Delivered",
        recipient: :nina,
        giver: :sam,
        cost: 45.00,
        link: "https://example.com/flowers",
        description: "Monthly flowers from a local florist."
      },
      {
        name: "Spa Gift Certificate",
        status: "In Transit",
        recipient: :nina,
        giver: :alex,
        cost: 120.00,
        link: "https://example.com/spa-gift-card",
        description: "90-minute relaxation package."
      }
    ],
    christmas_2026: [
      {
        name: "LEGO Flower Bouquet",
        status: "Idea",
        recipient: :alex,
        giver: :sam,
        cost: 59.99,
        link: "https://example.com/lego-flowers",
        description: "Creative build set for display."
      },
      {
        name: "Noise-Canceling Headphones",
        status: "Purchased",
        recipient: :alex,
        giver: :nina,
        cost: 199.00,
        link: "https://example.com/headphones",
        description: "Over-ear headphones for work and travel."
      },
      {
        name: "Silk Scarf",
        status: "Delivered",
        recipient: :nina,
        giver: :sam,
        cost: 39.00,
        link: "https://example.com/silk-scarf",
        description: "Lightweight winter scarf."
      }
    ]
  }.freeze

  def seed!
    puts "Seeding app review demo data..."

    clerk_user_id = ensure_clerk_user_id
    user = ensure_local_user(clerk_user_id)
    workspace = ensure_workspace(user)
    people = ensure_people(user, workspace)
    holidays = ensure_holidays(workspace, user, people)
    ensure_gifts(holidays, people, user)

    puts "App review demo data ready for #{REVIEWER_EMAIL}."
  end

  def ensure_clerk_user_id
    if ENV["CLERK_SECRET_KEY"].blank?
      puts "  - CLERK_SECRET_KEY not set; skipping Clerk user sync."
      return nil
    end

    clerk = Clerk::SDK.new
    existing_user = find_clerk_user_by_email(clerk)

    if existing_user
      update_request = ClerkHttpClient::UpdateUserRequest.new(
        first_name: REVIEWER_FIRST_NAME,
        last_name: REVIEWER_LAST_NAME,
        password: REVIEWER_PASSWORD,
        skip_password_checks: true
      )
      updated_user = clerk.users.update_user(existing_user.id, update_request)
      puts "  - Updated Clerk user #{REVIEWER_EMAIL}."
      return updated_user.id
    end

    create_request = ClerkHttpClient::CreateUserRequest.new(
      first_name: REVIEWER_FIRST_NAME,
      last_name: REVIEWER_LAST_NAME,
      email_address: [ REVIEWER_EMAIL ],
      password: REVIEWER_PASSWORD,
      skip_password_checks: true
    )
    created_user = clerk.users.create_user(create_request)
    puts "  - Created Clerk user #{REVIEWER_EMAIL}."
    created_user.id
  rescue StandardError => e
    warn "  - Clerk sync failed (#{e.class}): #{e.message}"
    nil
  end

  # Clerk SDK filtering can vary by version; query broad and match exact email in Ruby.
  def find_clerk_user_by_email(clerk)
    candidates = clerk.users.get_user_list(query: REVIEWER_EMAIL, limit: 20)
    candidates.find do |candidate|
      candidate.email_addresses.any? { |email| email.email_address.casecmp?(REVIEWER_EMAIL) }
    end
  rescue StandardError
    nil
  end

  def ensure_local_user(clerk_user_id)
    user = User.find_by(email: REVIEWER_EMAIL)
    user ||= clerk_user_id.present? ? User.find_by(clerk_user_id: clerk_user_id) : nil
    user ||= User.new

    user.email = REVIEWER_EMAIL
    user.clerk_user_id = clerk_user_id.presence || user.clerk_user_id.presence || REVIEWER_FALLBACK_CLERK_ID
    user.first_name = REVIEWER_FIRST_NAME
    user.last_name = REVIEWER_LAST_NAME
    user.subscription_plan ||= "free"
    user.save!

    puts "  - Local user synced: #{user.email}."
    user
  end

  def ensure_workspace(user)
    workspace = user.personal_workspace

    unless workspace
      workspace = Workspace.create!(
        name: "#{REVIEWER_FIRST_NAME}'s Workspace",
        workspace_type: "personal",
        created_by_user: user
      )
      puts "  - Created personal workspace."
    end

    membership = WorkspaceMembership.find_or_create_by!(workspace: workspace, user: user) do |m|
      m.role = "owner"
    end
    membership.update!(role: "owner") unless membership.owner?

    workspace
  end

  def ensure_people(user, workspace)
    people = {}

    PEOPLE.each do |attrs|
      person = Person.find_or_initialize_by(workspace: workspace, email: attrs[:email])
      person.user = user
      person.name = attrs[:name]
      person.relationship = attrs[:relationship]
      person.notes = attrs[:notes]
      person.save!
      people[attrs[:key]] = person
    end

    puts "  - Seeded #{people.size} people."
    people
  end

  def ensure_holidays(workspace, user, people)
    holidays = {}

    HOLIDAYS.each do |attrs|
      holiday = Holiday.find_or_initialize_by(
        workspace: workspace,
        name: attrs[:name],
        is_template: false
      )
      holiday.date = attrs[:date]
      holiday.icon = attrs[:icon]
      holiday.archived = false
      holiday.completed = false
      holiday.save!

      holiday_user = HolidayUser.find_or_create_by!(holiday: holiday, user: user) do |hu|
        hu.role = "owner"
      end
      holiday_user.update!(role: "owner") unless holiday_user.owner?

      people.each_value do |person|
        HolidayPerson.find_or_create_by!(holiday: holiday, person: person)
      end

      holidays[attrs[:key]] = holiday
    end

    puts "  - Seeded #{holidays.size} holidays."
    holidays
  end

  def ensure_gifts(holidays, people, user)
    status_map = GiftStatus.by_position.index_by(&:name)

    GIFTS.each do |holiday_key, holiday_gifts|
      holiday = holidays.fetch(holiday_key)

      holiday_gifts.each do |attrs|
        gift = Gift.find_or_initialize_by(holiday: holiday, name: attrs[:name])
        gift.gift_status = status_map.fetch(attrs[:status])
        gift.description = attrs[:description]
        gift.link = attrs[:link]
        gift.cost = attrs[:cost]
        gift.created_by = user
        gift.save!

        recipient = people[attrs[:recipient]]
        GiftRecipient.find_or_create_by!(gift: gift, person: recipient) if recipient

        giver = people[attrs[:giver]]
        GiftGiver.find_or_create_by!(gift: gift, person: giver) if giver
      end
    end

    total_gifts = GIFTS.values.sum(&:size)
    puts "  - Seeded #{total_gifts} gifts."
  end
end

AppReviewSeedData.seed!
