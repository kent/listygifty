require "test_helper"

# Renders every mail the app can send, with the data its real caller passes. A
# new public mailer method fails the coverage test below until it has a sample.
class AllMailersRenderTest < ActionMailer::TestCase
  FRONTEND_URL = "https://app.listygifty.test"
  ITEM_URL = "https://shop.example.org/wool-socks"

  SAMPLES = {
    AdminMailer => {
      custom_message: -> { AdminMailer.custom_message("recipient@example.com", "A note from us", "Hello there") }
    },
    DigestMailer => {
      daily_digest: -> { DigestMailer.daily_digest(@user, { holidays(:christmas) => gift_changes }) }
    },
    ExchangeMailer => {
      invitation: -> { ExchangeMailer.invitation(@annabel) },
      joined_organizer: -> { ExchangeMailer.joined_organizer(@annabel) },
      join_confirmation: -> { ExchangeMailer.join_confirmation(@annabel) },
      wishlist_reminder: -> { ExchangeMailer.wishlist_reminder(@annabel) },
      organizer_pending_joins: -> { ExchangeMailer.organizer_pending_joins(@exchange, [ @annabel, @bartholomew ]) },
      organizer_ready_to_draw: -> { ExchangeMailer.organizer_ready_to_draw(@exchange, [ @annabel, @bartholomew, @cordelia ]) },
      match_assignment: -> { ExchangeMailer.match_assignment(@annabel) },
      wishlist_updated: -> { ExchangeMailer.wishlist_updated(wishlist_added_notification(@annabel)) },
      wishlist_nudge: -> { ExchangeMailer.wishlist_nudge(nudge_notification(@annabel)) },
      cancellation: -> {
        ExchangeMailer.cancellation(
          email: @annabel.email,
          participant_name: @annabel.name,
          exchange_name: @exchange.name,
          owner_name: @exchange.user.safe_name
        )
      }
    },
    GiftListMailer => {
      gifts_added: -> { GiftListMailer.gifts_added(@user, holidays(:christmas), gift_changes.select(&:created?)) }
    },
    GuestClaimMailer => {
      claim_confirmation: -> { GuestClaimMailer.claim_confirmation(guest_claim) }
    },
    RemindersMailer => {
      pending_gifts: -> { RemindersMailer.pending_gifts(@user, { holidays(:christmas) => [ gifts(:sweater) ] }) },
      no_gifts_before_christmas: -> { RemindersMailer.no_gifts_before_christmas(@user, holidays(:christmas)) },
      no_gift_lists_december: -> { RemindersMailer.no_gift_lists_december(@user) }
    },
    WelcomeMailer => {
      welcome: -> { WelcomeMailer.welcome(@user) },
      welcome_from_invite: -> { WelcomeMailer.welcome_from_invite(@user, holidays(:christmas)) }
    }
  }.freeze

  setup do
    @old_frontend_url = ENV["FRONTEND_URL"]
    ENV["FRONTEND_URL"] = FRONTEND_URL

    @user = User.create!(email: "riley@example.com", clerk_user_id: "user_riley", first_name: "Riley")
    @exchange = GiftExchange.create!(
      workspace: workspaces(:one),
      user: users(:one),
      name: "Family Draw",
      status: "active",
      budget_min: 20,
      budget_max: 50,
      exchange_date: 1.month.from_now
    )
    @annabel = accepted_participant("Annabel Quill", first_name: "Annie")
    @bartholomew = accepted_participant("Bartholomew Finch", first_name: "Barty")
    @cordelia = accepted_participant("Cordelia Wren", first_name: "Cory")
    @annabel.update!(matched_participant: @bartholomew)
    @bartholomew.update!(matched_participant: @cordelia)
    @cordelia.update!(matched_participant: @annabel)
  end

  teardown do
    ENV["FRONTEND_URL"] = @old_frontend_url
  end

  test "every public mailer method has a sample" do
    mailers = Rails.root.glob("app/mailers/*_mailer.rb").map { |path| path.basename(".rb").to_s.camelize.constantize }
    expected = (mailers - [ ApplicationMailer ]).to_h { |mailer| [ mailer, mailer.action_methods.map(&:to_sym).sort ] }

    assert_equal expected, SAMPLES.transform_values { |actions| actions.keys.sort }
  end

  SAMPLES.each do |mailer, actions|
    actions.each do |action, build_mail|
      test "#{mailer}.#{action} renders text and html with a subject and frontend links" do
        mail = instance_exec(&build_mail)

        assert mail.subject.present?, "Missing subject"
        assert mail.text_part&.decoded.present?, "Missing text part"
        assert mail.html_part&.decoded.present?, "Missing html part"
        assert_only_frontend_links mail
      end
    end
  end

  test "reminder unsubscribe links carry the recipient's token" do
    mail = RemindersMailer.no_gift_lists_december(@user)

    [ mail.text_part, mail.html_part ].each do |part|
      assert_includes part.decoded, "#{FRONTEND_URL}/email-preferences/#{@user.email_preferences_token}"
    end
  end

  test "guest claim emails link the item the guest reserved" do
    mail = GuestClaimMailer.claim_confirmation(guest_claim)

    [ mail.text_part, mail.html_part ].each { |part| assert_includes part.decoded, ITEM_URL }
  end

  test "match emails never name the person who drew the recipient" do
    [ @annabel, @bartholomew, @cordelia ].each do |recipient|
      drawer = ExchangeParticipant.find_by!(matched_participant: recipient)
      secrets = [ drawer.name, drawer.display_name, drawer.email ]

      {
        match_assignment: ExchangeMailer.match_assignment(recipient),
        wishlist_updated: ExchangeMailer.wishlist_updated(wishlist_added_notification(recipient)),
        wishlist_nudge: ExchangeMailer.wishlist_nudge(nudge_notification(recipient))
      }.each do |action, mail|
        content = [ mail.subject, mail.text_part.decoded, mail.html_part.decoded ].join("\n")

        assert_includes content, @exchange.name, "#{action} did not render its exchange"
        secrets.each do |secret|
          assert_not_includes content, secret, "#{action} to #{recipient.name} named who drew them"
        end
      end
    end
  end

  test "the match assignment keeps the match itself out of the email" do
    mail = ExchangeMailer.match_assignment(@annabel)
    content = [ mail.subject, mail.text_part.decoded, mail.html_part.decoded ].join("\n")

    assert_includes content, @annabel.display_name
    [ @bartholomew.name, @bartholomew.display_name, @bartholomew.email ].each do |secret|
      assert_not_includes content, secret
    end
  end

  private

  def assert_only_frontend_links(mail)
    api_host = ActionMailer::Base.default_url_options.fetch(:host)

    [ mail.text_part, mail.html_part ].each do |part|
      links = part.decoded.scan(%r{https?://[^\s"'<>]+}) - [ ITEM_URL ]

      assert links.any?, "No links in the #{part.mime_type} part"
      links.each do |link|
        assert link == FRONTEND_URL || link.start_with?("#{FRONTEND_URL}/"), "#{link} does not use FRONTEND_URL"
        assert_not_equal api_host, URI(link).host, "#{link} points at the API"
      end
    end

    mail.html_part.decoded.scan(/\bhref="([^"]*)"/).flatten.each do |href|
      assert_match %r{\Ahttps?://}, href, "A relative link cannot work from an inbox"
    end
  end

  def accepted_participant(name, first_name:)
    email = "#{name.parameterize}@example.com"
    user = User.create!(email: email, clerk_user_id: "user_#{name.parameterize}", first_name: first_name)
    @exchange.exchange_participants.create!(name: name, email: email, user: user, status: "accepted")
  end

  def wishlist_added_notification(recipient)
    item = recipient.matched_participant.exchange_wishlist_items.create!(name: "Wool socks")
    ExchangeNotification.create!(
      gift_exchange: @exchange,
      recipient_participant: recipient,
      kind: "wishlist_item_added",
      exchange_wishlist_item: item
    )
  end

  def nudge_notification(recipient)
    ExchangeNotification.create!(gift_exchange: @exchange, recipient_participant: recipient, kind: "wishlist_nudge")
  end

  def gift_changes
    [
      GiftChange.create!(
        gift: gifts(:sweater), holiday: holidays(:christmas), user: @user, change_type: "created",
        changes_data: { name: "Wool Sweater", description: nil, cost: 49.99 }
      ),
      GiftChange.create!(
        gift: gifts(:sweater), holiday: holidays(:christmas), user: @user, change_type: "updated",
        changes_data: { name: [ "Sweater", "Wool Sweater" ] }
      )
    ]
  end

  def guest_claim
    wishlist = Wishlist.create!(name: "Birthday ideas", user: @user, workspace: workspaces(:one))
    item = wishlist.wishlist_items.create!(name: "Wool socks", url: ITEM_URL, price_min: 12)
    item.claims.create!(claimer_name: "Guest", claimer_email: "guest@example.com")
  end
end
