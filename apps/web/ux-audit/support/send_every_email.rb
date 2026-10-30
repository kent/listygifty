# Sends every email the app can send through real SMTP, using throwaway records
# that are rolled back afterwards. Refuses to run unless mail goes to Mailpit.
abort "Refusing to send: this only runs against local Mailpit" unless
  Rails.env.development? &&
  ActionMailer::Base.delivery_method == :smtp &&
  ActionMailer::Base.smtp_settings[:address] == "mailpit"

ActiveRecord::Base.transaction do
  stamp = SecureRandom.hex(4)
  user = User.create!(
    email: "mail.owner.#{stamp}@example.com", clerk_user_id: "ux_mail_#{stamp}",
    first_name: "Morgan", subscription_plan: "free"
  )
  workspace = user.ensure_personal_workspace!

  holiday = Holiday.create!(name: "Christmas", date: Date.new(Date.current.year, 12, 25), workspace: workspace)
  holiday.holiday_users.create!(user: user, role: "owner")
  status = GiftStatus.first
  gift = Gift.create!(name: "Wool socks", holiday: holiday, gift_status: status, created_by_user_id: user.id)
  change = GiftChange.create!(gift: gift, holiday: holiday, user: user, change_type: "created")

  exchange = GiftExchange.create!(
    workspace: workspace, user: user, name: "Mail Check #{stamp}", status: "active",
    budget_min: 20, budget_max: 50, exchange_date: 1.month.from_now
  )
  people = %w[Annie Barty Cory].map do |name|
    exchange.exchange_participants.create!(name: name, email: "#{name.downcase}.#{stamp}@example.com", status: "accepted")
  end
  people.each_with_index { |person, index| person.update!(matched_participant: people[(index + 1) % 3]) }

  item = people[1].exchange_wishlist_items.create!(name: "A good pen")
  added = exchange.exchange_notifications.create!(recipient_participant: people[0], exchange_wishlist_item: item, kind: "wishlist_item_added")
  nudge = exchange.exchange_notifications.create!(recipient_participant: people[1], kind: "wishlist_nudge")

  wishlist = Wishlist.create!(name: "Birthday", user: user, workspace: workspace, visibility: "shared")
  wish = wishlist.wishlist_items.create!(name: "Pasta machine")
  claim = wish.claims.create!(claimer_name: "Sam", claimer_email: "sam.#{stamp}@example.com", status: "reserved", quantity: 1)

  mails = {
    "AdminMailer.custom_message" => AdminMailer.custom_message("admin.#{stamp}@example.com", "A note from us", "Hello there"),
    "DigestMailer.daily_digest" => DigestMailer.daily_digest(user, { holiday => [ change ] }),
    "ExchangeMailer.invitation" => ExchangeMailer.invitation(people[0]),
    "ExchangeMailer.joined_organizer" => ExchangeMailer.joined_organizer(people[0]),
    "ExchangeMailer.join_confirmation" => ExchangeMailer.join_confirmation(people[0]),
    "ExchangeMailer.match_assignment" => ExchangeMailer.match_assignment(people[0]),
    "ExchangeMailer.wishlist_updated" => ExchangeMailer.wishlist_updated(added),
    "ExchangeMailer.wishlist_nudge" => ExchangeMailer.wishlist_nudge(nudge),
    "ExchangeMailer.cancellation" => ExchangeMailer.cancellation(
      email: people[0].email, participant_name: "Annie", exchange_name: exchange.name, owner_name: "Morgan"
    ),
    "GuestClaimMailer.claim_confirmation" => GuestClaimMailer.claim_confirmation(claim),
    "RemindersMailer.pending_gifts" => RemindersMailer.pending_gifts(user, { holiday => [ gift ] }),
    "RemindersMailer.no_gifts_before_christmas" => RemindersMailer.no_gifts_before_christmas(user, holiday),
    "RemindersMailer.no_gift_lists_december" => RemindersMailer.no_gift_lists_december(user),
    "WelcomeMailer.welcome" => WelcomeMailer.welcome(user),
    "WelcomeMailer.welcome_from_invite" => WelcomeMailer.welcome_from_invite(user, holiday)
  }

  expected = [ AdminMailer, DigestMailer, ExchangeMailer, GuestClaimMailer, RemindersMailer, WelcomeMailer ]
    .flat_map { |mailer| mailer.action_methods.map { |action| "#{mailer}.#{action}" } }.sort
  abort "This script is missing: #{expected - mails.keys}" unless (expected - mails.keys).empty?

  mails.each do |name, mail|
    mail.deliver_now
    puts "SENT #{name} -> #{mail.to.join(',')}"
  end

  raise ActiveRecord::Rollback
end
