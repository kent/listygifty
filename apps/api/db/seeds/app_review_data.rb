# App review seed data for staging/production reviewer flows.
# Creates a predictable reviewer account and sample records.

module AppReviewSeedData
  module_function

  REVIEWER_EMAIL = "marie@gifts.com"
  REVIEWER_PASSWORD = "ListyGifty_Review_2026!K7mP9#"
  REVIEWER_FIRST_NAME = "Marie"
  REVIEWER_LAST_NAME = "Reviewer"
  REVIEWER_FALLBACK_CLERK_ID = "seed_marie_gifts_com"

  PEOPLE = [
    {
      key: :alex,
      name: "Alex Parker",
      email: "alex.parker@gifts.com",
      relationship: "Partner",
      birthday: Date.new(1991, 6, 12),
      milestone_label: "Move-in anniversary",
      milestone_date: Date.new(2026, 8, 3),
      notes: "Likes practical gifts and gadgets."
    },
    {
      key: :sam,
      name: "Sam Lee",
      email: "sam.lee@gifts.com",
      relationship: "Friend",
      birthday: Date.new(1990, 5, 27),
      milestone_label: nil,
      milestone_date: nil,
      notes: "Enjoys cozy and home items."
    },
    {
      key: :nina,
      name: "Nina Rivera",
      email: "nina.rivera@gifts.com",
      relationship: "Mom",
      birthday: Date.new(1968, 5, 26),
      milestone_label: "Retirement trip",
      milestone_date: Date.new(2026, 10, 15),
      notes: "Prefers experiences and books."
    }
  ].freeze

  HOLIDAYS = [
    {
      key: :birthday_2026,
      name: "App Review Birthday 2026",
      date: Date.new(2026, 6, 12),
      icon: "cake"
    },
    {
      key: :mothers_day_2026,
      name: "App Review Mother's Day 2026",
      date: Date.new(2026, 5, 10),
      icon: "heart-handshake"
    },
    {
      key: :christmas_2026,
      name: "App Review Christmas 2026",
      date: Date.new(2026, 12, 25),
      icon: "gift"
    }
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

  REVIEW_EXCHANGE = {
    name: "App Review Secret Santa 2026",
    exchange_date: Date.new(2026, 12, 20),
    budget_min: 25.00,
    budget_max: 50.00,
    status: "active"
  }.freeze

  EXCHANGE_PARTICIPANTS = [
    {
      key: :marie,
      name: "#{REVIEWER_FIRST_NAME} #{REVIEWER_LAST_NAME}",
      email: REVIEWER_EMAIL,
      reviewer: true,
      wishlist_items: [
        {
          name: "Coffee Subscription",
          description: "Light roast beans.",
          price: 35.00,
          link: "https://example.com/coffee"
        }
      ]
    },
    {
      key: :alex,
      name: "Alex Parker",
      email: "alex.parker@gifts.com",
      wishlist_items: [
        {
          name: "Desk Plant",
          description: "Low-maintenance office plant.",
          price: 28.00,
          link: "https://example.com/desk-plant"
        }
      ]
    },
    {
      key: :sam,
      name: "Sam Lee",
      email: "sam.lee@gifts.com",
      wishlist_items: [
        {
          name: "Cozy Throw Blanket",
          description: "Soft neutral blanket.",
          price: 42.00,
          link: "https://example.com/blanket"
        }
      ]
    },
    {
      key: :nina,
      name: "Nina Rivera",
      email: "nina.rivera@gifts.com",
      wishlist_items: [
        {
          name: "Bookshop Gift Card",
          description: "Local bookstore credit.",
          price: 30.00,
          link: "https://example.com/bookshop"
        }
      ]
    }
  ].freeze

  EXCHANGE_MATCHES = {
    marie: :alex,
    alex: :nina,
    nina: :sam,
    sam: :marie
  }.freeze

  BUSINESS_WORKSPACE_NAME = "BrightWorks Holiday Gifting"
  BUSINESS_COMPANY_NAME = "BrightWorks Studio"
  BUSINESS_USE_CASE = "holiday-box"
  BUSINESS_HOLIDAY = {
    name: "BrightWorks Remote Holiday Boxes 2026",
    date: Date.new(2026, 12, 12),
    icon: "gift"
  }.freeze
  BUSINESS_STATUS_SEQUENCE = [ "Idea", "Purchased", "In Transit", "Delivered", "Done" ].freeze
  BUSINESS_RECIPIENT_ROWS = [
    [ "Jamie Lee", "jamie.lee", "Customer Success", "1991-03-14", "Work anniversary", "2026-09-01", "Prefers no alcohol.", "123 Maple Street", nil, "Toronto", "ON", "M5V 2T6", "CA" ],
    [ "Alex Chen", "alex.chen", "Engineering", "1988-11-22", "Promotion", "2026-07-18", "Likes desk gear.", "48 King Street West", "Apt 1202", "Toronto", "ON", "M5H 1A1", "CA" ],
    [ "Priya Shah", "priya.shah", "People Ops", "1992-04-07", "Work anniversary", "2026-06-03", "Tea and wellness items.", "77 Queen Street", nil, "Ottawa", "ON", "K1P 5C2", "CA" ],
    [ "Marcus Brown", "marcus.brown", "Sales", "1985-09-29", "New manager milestone", "2026-08-20", "Outdoor gear.", "210 Granville Street", "Suite 5", "Vancouver", "BC", "V6C 1T2", "CA" ],
    [ "Elena Garcia", "elena.garcia", "Design", "1994-01-18", "Work anniversary", "2026-10-04", "Art books.", "800 Rue Sherbrooke", nil, "Montreal", "QC", "H3A 1G1", "CA" ],
    [ "Noah Wilson", "noah.wilson", "Support", "1990-07-11", "Parent leave return", "2026-09-14", "Coffee and snacks.", "333 5th Avenue", nil, "Calgary", "AB", "T2P 3B6", "CA" ],
    [ "Aisha Khan", "aisha.khan", "Finance", "1987-02-25", "CPA completion", "2026-11-06", "Kitchen tools.", "22 Hollis Street", "Unit 9", "Halifax", "NS", "B3J 1T8", "CA" ],
    [ "Ben Taylor", "ben.taylor", "Marketing", "1993-12-02", "Work anniversary", "2026-05-30", "Running accessories.", "1410 Broadway", nil, "New York", "NY", "10018", "US" ],
    [ "Grace Park", "grace.park", "Engineering", "1989-08-16", "Conference speaker", "2026-06-24", "Minimalist office items.", "55 South Lake Avenue", "Floor 4", "Pasadena", "CA", "91101", "US" ],
    [ "Owen Davis", "owen.davis", "Operations", "1995-05-05", "Work anniversary", "2026-12-01", "Board games.", "420 Congress Avenue", nil, "Austin", "TX", "78701", "US" ],
    [ "Maya Patel", "maya.patel", "Product", "1991-10-13", "Launch lead", "2026-07-09", "Travel accessories.", "160 Spear Street", "Suite 700", "San Francisco", "CA", "94105", "US" ],
    [ "Leo Martinez", "leo.martinez", "Customer Success", "1986-06-30", "Work anniversary", "2026-08-12", "Local food gifts.", "500 W Madison Street", nil, "Chicago", "IL", "60661", "US" ],
    [ "Sofia Rossi", "sofia.rossi", "Sales", "1994-03-21", "Quota club", "2026-10-21", "Home office decor.", "101 Seaport Boulevard", "Apt 18B", "Boston", "MA", "02210", "US" ],
    [ "Ethan Moore", "ethan.moore", "Engineering", "1984-12-19", "Work anniversary", "2026-11-15", "Mechanical keyboards.", "1100 Peachtree Street", nil, "Atlanta", "GA", "30309", "US" ],
    [ "Hana Kim", "hana.kim", "Design", "1992-09-04", "Design award", "2026-09-27", "Stationery.", "701 Pike Street", "Unit 303", "Seattle", "WA", "98101", "US" ],
    [ "Liam Murphy", "liam.murphy", "People Ops", "1989-01-09", "New hire buddy", "2026-06-17", "Cycling gear.", "80 Collins Street", nil, "Melbourne", "VIC", "3000", "AU" ],
    [ "Zoe Nguyen", "zoe.nguyen", "Support", "1993-07-28", "Work anniversary", "2026-07-31", "Plant care items.", "1 George Street", "Level 10", "Sydney", "NSW", "2000", "AU" ],
    [ "Mateo Silva", "mateo.silva", "Operations", "1990-02-03", "Office launch", "2026-08-28", "Music and audio.", "Avenida Paulista 1000", nil, "Sao Paulo", "SP", "01310-100", "BR" ],
    [ "Amara Okafor", "amara.okafor", "Marketing", "1988-04-12", "Campaign launch", "2026-10-08", "Needs address confirmation.", nil, nil, nil, nil, nil, nil ],
    [ "Theo Martin", "theo.martin", "Finance", "1995-11-06", "Work anniversary", "2026-12-18", "Cooking classes.", "15 Rue de Rivoli", "Etage 2", "Paris", nil, "75004", "FR" ]
  ].freeze

  BUSINESS_RECIPIENTS = BUSINESS_RECIPIENT_ROWS.map do |row|
    name, email_prefix, relationship, birthday, milestone_label, milestone_date, notes,
      street_line_1, street_line_2, city, state, postal_code, country = row

    {
      key: email_prefix.tr(".", "_").to_sym,
      name: name,
      email: "#{email_prefix}@brightworks.example",
      relationship: relationship,
      birthday: Date.iso8601(birthday),
      milestone_label: milestone_label,
      milestone_date: Date.iso8601(milestone_date),
      notes: notes,
      address: street_line_1 && {
        label: "#{name} home",
        street_line_1: street_line_1,
        street_line_2: street_line_2,
        city: city,
        state: state,
        postal_code: postal_code,
        country: country
      }
    }
  end.freeze

  def seed!
    puts "Seeding app review demo data..."

    clerk_user_id = ensure_clerk_user_id
    user = ensure_local_user(clerk_user_id)
    workspace = ensure_workspace(user)
    people = ensure_people(user, workspace)
    holidays = ensure_holidays(workspace, user, people)
    ensure_gifts(holidays, people, user)
    ensure_exchange(workspace, user)
    business_workspace = ensure_business_workspace(user)
    business_people = ensure_business_people(user, business_workspace)
    business_holiday = ensure_business_holiday(business_workspace, user, business_people)
    ensure_business_gifts(business_holiday, business_people, user)

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
      person.birthday = attrs[:birthday]
      person.milestone_label = attrs[:milestone_label]
      person.milestone_date = attrs[:milestone_date]
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
        ensure_gift_recipient(gift, recipient) if recipient

        giver = people[attrs[:giver]]
        GiftGiver.find_or_create_by!(gift: gift, person: giver) if giver
      end
    end

    total_gifts = GIFTS.values.sum(&:size)
    puts "  - Seeded #{total_gifts} gifts."
  end

  def ensure_gift_recipient(gift, person)
    gift_recipient = GiftRecipient.find_or_initialize_by(gift: gift, person: person)
    gift_recipient.shipping_address = person.default_shipping_address if person.default_shipping_address
    gift_recipient.save!
  end

  def ensure_business_workspace(user)
    workspace = Workspace.find_or_initialize_by(
      created_by_user: user,
      name: BUSINESS_WORKSPACE_NAME
    )
    workspace.workspace_type = "business"
    workspace.show_gift_addresses = true
    workspace.save!

    membership = WorkspaceMembership.find_or_create_by!(workspace: workspace, user: user) do |m|
      m.role = "owner"
    end
    membership.update!(role: "owner") unless membership.owner?

    company_profile = workspace.company_profile || workspace.build_company_profile
    company_profile.name = BUSINESS_COMPANY_NAME
    company_profile.tax_metadata = (company_profile.tax_metadata || {}).merge(
      "initial_use_case" => BUSINESS_USE_CASE
    )
    company_profile.save!
    ensure_business_company_address(company_profile)

    puts "  - Seeded business workspace: #{workspace.name}."
    workspace
  end

  def ensure_business_company_address(company_profile)
    address = company_profile.addresses.find_or_initialize_by(label: "BrightWorks HQ")
    address.street_line_1 = "240 Richmond Street West"
    address.street_line_2 = "Suite 1200"
    address.city = "Toronto"
    address.state = "ON"
    address.postal_code = "M5V 1V6"
    address.country = "CA"
    address.is_default = true
    address.save!
  end

  def ensure_business_people(user, workspace)
    company_profile = workspace.company_profile

    people = BUSINESS_RECIPIENTS.each_with_object({}) do |attrs, result|
      person = Person.find_or_initialize_by(workspace: workspace, email: attrs[:email])
      person.user = user
      person.name = attrs[:name]
      person.relationship = attrs[:relationship]
      person.birthday = attrs[:birthday]
      person.milestone_label = attrs[:milestone_label]
      person.milestone_date = attrs[:milestone_date]
      person.notes = attrs[:notes]
      person.save!

      if attrs[:address]
        address = ensure_person_address(company_profile, attrs[:address])
        person.update!(default_shipping_address: address)
      elsif person.default_shipping_address_id?
        person.update!(default_shipping_address: nil)
      end

      result[attrs[:key]] = person
    end

    puts "  - Seeded #{people.size} business recipients."
    people
  end

  def ensure_person_address(company_profile, attrs)
    address = company_profile.addresses.find_or_initialize_by(label: attrs[:label])
    address.street_line_1 = attrs[:street_line_1]
    address.street_line_2 = attrs[:street_line_2]
    address.city = attrs[:city]
    address.state = attrs[:state]
    address.postal_code = attrs[:postal_code]
    address.country = attrs[:country]
    address.is_default = false
    address.save!
    address
  end

  def ensure_business_holiday(workspace, user, people)
    holiday = Holiday.find_or_initialize_by(
      workspace: workspace,
      name: BUSINESS_HOLIDAY[:name],
      is_template: false
    )
    holiday.date = BUSINESS_HOLIDAY[:date]
    holiday.icon = BUSINESS_HOLIDAY[:icon]
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

    puts "  - Seeded business holiday list: #{holiday.name}."
    holiday
  end

  def ensure_business_gifts(holiday, people, user)
    status_map = GiftStatus.by_position.index_by(&:name)

    people.values.each_with_index do |person, index|
      gift = Gift.find_or_initialize_by(
        holiday: holiday,
        name: "Remote Holiday Box - #{person.name}"
      )
      gift.gift_status = status_map.fetch(BUSINESS_STATUS_SEQUENCE[index % BUSINESS_STATUS_SEQUENCE.length])
      gift.description = "Curated BrightWorks holiday box for #{person.relationship.downcase}."
      gift.link = "https://example.com/brightworks-holiday-box"
      gift.cost = 72 + (index % 5) * 6
      gift.created_by = user
      gift.save!

      ensure_gift_recipient(gift, person)
    end

    puts "  - Seeded #{people.size} business holiday gifts."
  end

  def ensure_exchange(workspace, user)
    exchange = GiftExchange.find_or_initialize_by(
      workspace: workspace,
      user: user,
      name: REVIEW_EXCHANGE[:name]
    )
    exchange.exchange_date = REVIEW_EXCHANGE[:exchange_date]
    exchange.budget_min = REVIEW_EXCHANGE[:budget_min]
    exchange.budget_max = REVIEW_EXCHANGE[:budget_max]
    exchange.status = REVIEW_EXCHANGE[:status]
    exchange.save!

    participants = ensure_exchange_participants(exchange, user)
    ensure_exchange_wishlist_items(participants)
    ensure_exchange_matches(participants)
    ensure_exchange_exclusion(exchange, participants)

    puts "  - Seeded review gift exchange with #{participants.size} participants."
  end

  def ensure_exchange_participants(exchange, user)
    EXCHANGE_PARTICIPANTS.each_with_object({}) do |attrs, participants|
      participant = ExchangeParticipant.find_or_initialize_by(
        gift_exchange: exchange,
        email: attrs[:email]
      )
      participant.name = attrs[:name]
      participant.status = "accepted"
      participant.user = attrs[:reviewer] ? user : nil
      participant.save!
      participants[attrs[:key]] = participant
    end
  end

  def ensure_exchange_wishlist_items(participants)
    EXCHANGE_PARTICIPANTS.each do |participant_attrs|
      participant = participants.fetch(participant_attrs[:key])
      participant_attrs[:wishlist_items].each do |attrs|
        item = ExchangeWishlistItem.find_or_initialize_by(
          exchange_participant: participant,
          name: attrs[:name]
        )
        item.description = attrs[:description]
        item.price = attrs[:price]
        item.link = attrs[:link]
        item.save!
      end
    end
  end

  def ensure_exchange_matches(participants)
    EXCHANGE_MATCHES.each do |giver_key, receiver_key|
      participants.fetch(giver_key).update!(
        matched_participant: participants.fetch(receiver_key)
      )
    end
  end

  def ensure_exchange_exclusion(exchange, participants)
    participant_a = participants.fetch(:alex)
    participant_b = participants.fetch(:sam)
    return if ExchangeExclusion.exists_between?(participant_a, participant_b)

    ExchangeExclusion.create!(
      gift_exchange: exchange,
      participant_a: participant_a,
      participant_b: participant_b
    )
  end
end

AppReviewSeedData.seed!
