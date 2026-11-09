require "test_helper"
require "minitest/mock"
require "support/account_deletion_test_helpers"

class AccountDeletionServiceTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper
  include ActionMailer::TestHelper
  include AccountDeletionTestHelpers

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
  end

  teardown do
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
  end

  # ============================================================================
  # The account itself
  # ============================================================================

  test "removes the account, what it owned, and the Clerk user" do
    leaver = person("leaver")
    workspace = leaver.personal_workspace
    contact = workspace.people.create!(user: leaver, name: "Mum")
    list = Holiday.create!(name: "Christmas", workspace: workspace)
    list.holiday_users.create!(user: leaver, role: "owner")
    gift = Gift.create!(name: "Scarf", holiday: list, gift_status: gift_statuses(:idea), created_by: leaver)

    AccountDeletionService.delete!(leaver)

    assert_not User.exists?(leaver.id)
    assert_not Workspace.exists?(workspace.id)
    assert_not Person.exists?(contact.id)
    assert_not Holiday.exists?(list.id)
    assert_not Gift.exists?(gift.id)
    assert_equal [ leaver.clerk_user_id ], @clerk_users.deleted_user_ids
  end

  test "leaves no reference to the person and none of their details anywhere" do
    leaver = person("leaver", first_name: "Zephyrine", last_name: "Quillfeather",
      phone: "+15550001234", username: "zquillfeather")
    relative = person("relative")
    admin = person("admin")
    workspace = leaver.personal_workspace

    # Their own gift planning, including history that names them.
    contact = workspace.people.create!(user: leaver, name: "Mum")
    list = Holiday.create!(name: "Christmas", workspace: workspace)
    list.holiday_users.create!(user: leaver, role: "owner")
    gift = Gift.create!(name: "Scarf", holiday: list, gift_status: gift_statuses(:idea), created_by: leaver)
    gift.gift_recipients.create!(person: contact)
    EmailDelivery.log_sent!(user: leaver, kind: "pending_gifts", subject: "Reminder", dedupe_key: "d1", holiday: list)
    leaver.notification_prefs

    # Their activity on someone else's list.
    relatives_list = Holiday.create!(name: "Birthdays", workspace: relative.personal_workspace)
    relatives_list.holiday_users.create!(user: relative, role: "owner")
    relatives_list.holiday_users.create!(user: leaver, role: "collaborator")
    their_gift = Gift.create!(name: "Book", holiday: relatives_list, gift_status: gift_statuses(:idea), created_by: leaver)
    GiftChange.create!(gift: their_gift, holiday: relatives_list, user: leaver, change_type: :created,
      changes_data: { name: "Book" })

    # Credentials and connected apps.
    ApiKey.generate_for(leaver, name: "Laptop")
    client = OauthClient.generate(name: "Their client", redirect_uris: [ "https://example.com/cb" ], user: leaver).client
    OauthAccessToken.generate_for(client: client, user: leaver, scopes: [ "read" ], resource: "https://api.example.com/mcp")
    OauthAuthorizationCode.generate_for(client: client, user: leaver, redirect_uri: "https://example.com/cb",
      scopes: [ "read" ], code_challenge: "a" * 43, code_challenge_method: "S256", resource: "https://api.example.com/mcp")
    OauthAuthorizationRequest.create!(oauth_client: client, user: leaver, request_digest: SecureRandom.hex,
      redirect_uri: "https://example.com/cb", resource: "https://api.example.com/mcp", scopes: [ "read" ],
      code_challenge: "a" * 43, code_challenge_method: "S256", expires_at: 5.minutes.from_now)

    # Analytics, including a row from someone else inside their workspace.
    visitor = AnalyticsVisitor.create!(anonymous_id: SecureRandom.hex, user: leaver,
      first_seen_at: Time.current, last_seen_at: Time.current)
    other_visitor = AnalyticsVisitor.create!(anonymous_id: SecureRandom.hex, user: relative,
      first_seen_at: Time.current, last_seen_at: Time.current)
    analytics_event(visitor, user: leaver, workspace: workspace)
    analytics_event(other_visitor, user: relative, workspace: workspace)
    AnalyticsMetricGoal.create!(name: "Signups", metric_key: "signups", target_value: 10,
      comparison_operator: "gte", start_date: Date.current, target_date: 30.days.from_now.to_date,
      granularity: "week", status: "active", created_by: leaver)

    # Mail an administrator drafted to them.
    AdminEmailDraft.create!(created_by: admin, recipient: leaver, api_key: ApiKey.generate_for(admin, name: "Admin").api_key,
      recipient_email: leaver.email, subject: "Hello", body: "Hi", confirmation_digest: SecureRandom.hex,
      expires_at: 10.minutes.from_now)

    # Wishlists, claims, and invitations in both directions.
    wishlist = Wishlist.create!(name: "Mine", user: leaver, workspace: workspace, visibility: "shared")
    wishlist.wishlist_items.create!(name: "Socks")
    relatives_wishlist = Wishlist.create!(name: "Theirs", user: relative, workspace: relative.personal_workspace, visibility: "shared")
    claimed = relatives_wishlist.wishlist_items.create!(name: "Mug", quantity: 2)
    claimed.claims.create!(user: leaver, claimer_name: "Zephyrine Quillfeather", claimer_email: leaver.email)
    invite = workspace.workspace_invites.create!(invited_by: leaver, email: "friend@example.com")
    invite.update!(accepted_at: Time.current, accepted_by: relative)
    relative.personal_workspace.workspace_invites.create!(invited_by: relative, email: leaver.email,
      accepted_at: Time.current, accepted_by: leaver)

    # Exchanges on both sides of the line.
    owned = inviting_exchange(leaver, relative, name: "Their exchange")
    _, rows = drawn_exchange(relative, leaver, admin, name: "Relative's exchange")
    rows.second.wishlist!.wishlist_items.create!(name: "Tea")

    details = [ leaver.email, leaver.last_name, leaver.phone, leaver.username ]

    AccountDeletionService.delete!(leaver)

    assert_equal [], references_to_user(leaver.id)
    assert_equal [], details.flat_map { |detail| columns_mentioning(detail) }
    assert_not GiftExchange.exists?(owned.id)
    assert ExchangeParticipant.exists?(rows.second.id)
  end

  # ============================================================================
  # Exchanges other people run
  # ============================================================================

  test "someone else's drawn exchange keeps its draw and loses their details" do
    organizer = person("organizer")
    leaver = person("leaver", first_name: "Robin", last_name: "Hartley")
    third = person("third")
    exchange, (organizer_row, leaver_row, third_row) = drawn_exchange(organizer, leaver, third)
    old_token = leaver_row.invite_token

    AccountDeletionService.delete!(leaver)

    leaver_row.reload
    assert_equal leaver_row.id, organizer_row.reload.matched_participant_id, "the giver keeps their match"
    assert_equal third_row.id, leaver_row.matched_participant_id, "the row keeps its place in the ring"
    assert_equal organizer_row.id, third_row.reload.matched_participant_id
    assert_equal "active", exchange.reload.status
    assert_nil leaver_row.user_id
    assert leaver_row.anonymized?
    assert_not_includes leaver_row.email, "leaver"
    assert_not_equal old_token, leaver_row.invite_token, "an old invite link must stop working"
    assert leaver_row.valid?, "the row must still save if anything touches it later"
  end

  test "keeps only the first word of the name the exchange already had" do
    organizer = person("organizer")
    leaver = person("leaver", first_name: "Account", last_name: "Name")
    exchange = GiftExchange.create!(name: "Named", user: organizer, workspace: organizer.personal_workspace, status: "inviting")
    join_exchange(exchange, organizer)
    giver = join_exchange(exchange, person("giver"))
    row = join_exchange(exchange, leaver, name: "Robin Hartley-Jones")
    giver.update!(matched_participant: row)
    exchange.update!(status: "active")

    AccountDeletionService.delete!(leaver)

    assert_equal "Robin", row.reload.name
    assert_equal "Robin", row.display_name
  end

  test "falls back to a neutral label when the only name on the row is an email address" do
    organizer = person("organizer")
    leaver = person("leaver", first_name: nil, last_name: nil)
    exchange = GiftExchange.create!(name: "Named", user: organizer, workspace: organizer.personal_workspace, status: "inviting")
    giver = join_exchange(exchange, organizer)
    row = join_exchange(exchange, leaver, name: leaver.safe_name)
    giver.update!(matched_participant: row)
    exchange.update!(status: "active")

    AccountDeletionService.delete!(leaver)

    assert_equal ExchangeParticipant::ANONYMIZED_NAME, row.reload.name
  end

  test "their ideas in a drawn exchange go, even when the giver was notified about them" do
    organizer = person("organizer")
    leaver = person("leaver")
    _, (organizer_row, leaver_row, _third_row) = drawn_exchange(organizer, leaver, person("third"))
    idea = leaver_row.wishlist!.wishlist_items.create!(name: "Tea")
    notification = ExchangeNotification.create!(gift_exchange: organizer_row.gift_exchange,
      recipient_participant: organizer_row, wishlist_item: idea, kind: "wishlist_item_added")

    AccountDeletionService.delete!(leaver)

    assert_not WishlistItem.exists?(idea.id)
    assert_not ExchangeNotification.exists?(notification.id)
  end

  test "a photo on one of their ideas is queued for purging" do
    organizer = person("organizer")
    leaver = person("leaver")
    _, (_organizer_row, leaver_row, _third_row) = drawn_exchange(organizer, leaver, person("third"))
    idea = leaver_row.wishlist!.wishlist_items.create!(name: "Tea")
    idea.photo.attach(io: StringIO.new("image"), filename: "tea.png", content_type: "image/png")
    clear_enqueued_jobs

    AccountDeletionService.delete!(leaver)

    assert_enqueued_jobs 1, only: ActiveStorage::PurgeJob
  end

  test "an exchange that has not drawn drops them instead of drawing a ghost" do
    organizer = person("organizer")
    leaver = person("leaver")
    third = person("third")
    exchange = inviting_exchange(organizer, leaver, third)
    leaver_row = exchange.exchange_participants.find_by!(user: leaver)

    AccountDeletionService.delete!(leaver)

    assert_not ExchangeParticipant.exists?(leaver_row.id)
    assert_equal 2, exchange.exchange_participants.accepted.count
    ExchangeDrawingService.new(exchange).publish!
    assert_equal 2, exchange.exchange_participants.where.not(matched_participant_id: nil).count
  end

  test "a redraw leaves out someone who deleted their account" do
    organizer = person("organizer")
    leaver = person("leaver")
    exchange, (_organizer_row, leaver_row, *) =
      drawn_exchange(organizer, leaver, person("third"), person("fourth"))

    AccountDeletionService.delete!(leaver)
    clear_enqueued_jobs

    ExchangeDrawingService.new(exchange).redraw!

    assert_not exchange.exchange_participants.where(matched_participant_id: leaver_row.id).exists?
    delivered_to = exchange.exchange_participants.accepted.pluck(:id)
    assert_equal 3, delivered_to.size
    assert_enqueued_emails 3
  end

  test "reopening an exchange clears out anyone who deleted their account" do
    organizer = person("organizer")
    leaver = person("leaver")
    exchange, (_organizer_row, leaver_row, *) = drawn_exchange(organizer, leaver, person("third"))

    AccountDeletionService.delete!(leaver)

    ExchangeDrawingService.new(exchange).reopen!

    assert_not ExchangeParticipant.exists?(leaver_row.id)
    assert_equal 2, exchange.exchange_participants.accepted.count
  end

  test "a giver cannot nudge a match who deleted their account" do
    organizer = person("organizer")
    leaver = person("leaver")
    exchange, (organizer_row, *) = drawn_exchange(organizer, leaver, person("third"))

    AccountDeletionService.delete!(leaver)

    error = assert_raises(ExchangeNotificationService::NudgeError) do
      ExchangeNotificationService.nudge_match!(organizer_row.reload)
    end
    assert_match(/no longer has an account/, error.message)
    assert_equal false, exchange.reload.capabilities_for(organizer)[:nudge_match]
    assert_no_enqueued_emails
  end

  # ============================================================================
  # Exchanges they run
  # ============================================================================

  test "an owned exchange goes through the cancellation path, so relatives are told" do
    leaver = person("leaver")
    relative = person("relative")
    other = person("other")
    exchange, = drawn_exchange(leaver, relative, other)

    perform_enqueued_jobs { AccountDeletionService.delete!(leaver) }

    assert_not GiftExchange.exists?(exchange.id)
    told = ActionMailer::Base.deliveries.select { |mail| mail.subject.include?("Cancelled") }.flat_map(&:to)
    assert_equal [ relative.email, other.email ].sort, told.sort
  end

  test "an owned exchange with a wishlist notification can still be deleted" do
    leaver = person("leaver")
    exchange, (leaver_row, relative_row, *) = drawn_exchange(leaver, person("relative"))
    idea = relative_row.wishlist!.wishlist_items.create!(name: "Tea")
    ExchangeNotification.create!(gift_exchange: exchange, recipient_participant: leaver_row,
      wishlist_item: idea, kind: "wishlist_item_added")

    AccountDeletionService.delete!(leaver)

    assert_not GiftExchange.exists?(exchange.id)
  end

  test "an exchange they ran in a shared workspace is cancelled, not silently dropped" do
    leaver = person("leaver")
    heir = person("heir")
    workspace = Workspace.create!(name: "Family", workspace_type: "business", created_by_user: leaver)
    workspace.workspace_memberships.create!(user: leaver, role: "owner")
    share_workspace(workspace, heir)
    exchange = GiftExchange.create!(name: "Shared draw", user: leaver, workspace: workspace, status: "inviting")
    join_exchange(exchange, heir)

    perform_enqueued_jobs { AccountDeletionService.delete!(leaver) }

    assert Workspace.exists?(workspace.id)
    assert_not GiftExchange.exists?(exchange.id)
    told = ActionMailer::Base.deliveries.select { |mail| mail.subject.include?("Cancelled") }.flat_map(&:to)
    assert_equal [ heir.email ], told
  end

  test "an exchange left behind in a workspace that goes is still cancelled properly" do
    leaver = person("leaver")
    former_member = person("former")
    relative = person("relative")
    exchange = GiftExchange.create!(name: "Left behind", user: former_member,
      workspace: leaver.personal_workspace, status: "inviting")
    join_exchange(exchange, relative)

    perform_enqueued_jobs { AccountDeletionService.delete!(leaver) }

    assert_not GiftExchange.exists?(exchange.id)
    told = ActionMailer::Base.deliveries.select { |mail| mail.subject.include?("Cancelled") }.flat_map(&:to)
    assert_equal [ relative.email ], told
  end

  # ============================================================================
  # Workspaces
  # ============================================================================

  test "a shared workspace passes to an admin ahead of a plain member" do
    leaver = person("leaver")
    workspace = Workspace.create!(name: "Fenwick Family", workspace_type: "business", created_by_user: leaver)
    workspace.workspace_memberships.create!(user: leaver, role: "owner")
    member = person("member")
    admin = person("admin")
    share_workspace(workspace, member)
    share_workspace(workspace, admin, role: "admin")

    AccountDeletionService.delete!(leaver)

    workspace.reload
    assert_equal admin, workspace.owner
    assert_equal admin.id, workspace.created_by_user_id
    assert_equal "member", workspace.role_for(member)
    assert_equal "Fenwick Family", workspace.name
    assert_not workspace.member?(leaver)
  end

  test "the longest-standing member inherits when there is no admin" do
    leaver = person("leaver")
    workspace = Workspace.create!(name: "Family", workspace_type: "business", created_by_user: leaver)
    workspace.workspace_memberships.create!(user: leaver, role: "owner")
    first = person("first")
    second = person("second")
    share_workspace(workspace, first).update!(created_at: 2.days.ago)
    share_workspace(workspace, second).update!(created_at: 1.day.ago)

    AccountDeletionService.delete!(leaver)

    assert_equal first, workspace.reload.owner
  end

  test "a personal workspace with other members stops carrying the leaver's name or type" do
    leaver = person("leaver", first_name: nil)
    workspace = leaver.personal_workspace
    assert_includes workspace.name, leaver.email, "starting point: the name holds their address"
    heir = person("heir", first_name: "Marie")
    share_workspace(workspace, heir)

    AccountDeletionService.delete!(leaver)

    workspace.reload
    assert_equal "Marie's Group", workspace.name
    assert_equal "business", workspace.workspace_type
    assert_equal heir.personal_workspace, heir.reload.personal_workspace
  end

  test "a plain member leaving a workspace changes nothing else about it" do
    owner = person("owner")
    leaver = person("leaver")
    workspace = owner.personal_workspace
    share_workspace(workspace, leaver)

    AccountDeletionService.delete!(leaver)

    workspace.reload
    assert_equal owner, workspace.owner
    assert_equal "personal", workspace.workspace_type
    assert_equal owner.id, workspace.created_by_user_id
  end

  test "a workspace they created and already left no longer names them" do
    leaver = person("leaver")
    heir = person("heir")
    workspace = Workspace.create!(name: "Old team", workspace_type: "business", created_by_user: leaver)
    workspace.workspace_memberships.create!(user: heir, role: "owner")

    AccountDeletionService.delete!(leaver)

    assert_equal heir.id, workspace.reload.created_by_user_id
  end

  test "contacts they added to a shared workspace stay, with the gifts that use them" do
    leaver = person("leaver")
    owner = person("owner")
    workspace = owner.personal_workspace
    share_workspace(workspace, leaver)
    contact = workspace.people.create!(user: leaver, name: "Grandma")
    list = Holiday.create!(name: "Christmas", workspace: workspace)
    list.holiday_users.create!(user: owner, role: "owner")
    gift = Gift.create!(name: "Scarf", holiday: list, gift_status: gift_statuses(:idea), created_by: owner)
    gift.gift_recipients.create!(person: contact)

    AccountDeletionService.delete!(leaver)

    assert_equal owner.id, contact.reload.user_id
    assert_equal [ contact ], gift.reload.recipients.to_a
  end

  test "invitations they sent are withdrawn and ones they accepted no longer identify them" do
    owner = person("owner")
    leaver = person("leaver")
    workspace = owner.personal_workspace
    share_workspace(workspace, leaver, role: "admin")
    sent = workspace.workspace_invites.create!(invited_by: leaver, email: "friend@example.com")
    accepted = workspace.workspace_invites.create!(invited_by: owner, email: leaver.email,
      accepted_at: Time.current, accepted_by: leaver)

    AccountDeletionService.delete!(leaver)

    assert_not WorkspaceInvite.exists?(sent.id)
    accepted.reload
    assert_nil accepted.accepted_by_id
    assert_nil accepted.email
  end

  # ============================================================================
  # Gift lists
  # ============================================================================

  test "a shared list in a surviving workspace passes to its longest-standing collaborator" do
    owner = person("owner")
    leaver = person("leaver")
    workspace = owner.personal_workspace
    share_workspace(workspace, leaver)
    collaborator = person("collaborator")
    list = Holiday.create!(name: "Christmas", workspace: workspace)
    list.holiday_users.create!(user: leaver, role: "owner")
    list.holiday_users.create!(user: collaborator, role: "collaborator")

    AccountDeletionService.delete!(leaver)

    assert_equal collaborator, list.reload.owner
  end

  test "a list only they could see does not stay behind in a surviving workspace" do
    owner = person("owner")
    leaver = person("leaver")
    workspace = owner.personal_workspace
    share_workspace(workspace, leaver)
    list = Holiday.create!(name: "Private", workspace: workspace)
    list.holiday_users.create!(user: leaver, role: "owner")

    AccountDeletionService.delete!(leaver)

    assert_not Holiday.exists?(list.id)
  end

  test "a shared list in their personal workspace goes, even if a collaborator got reminders for it" do
    leaver = person("leaver")
    collaborator = person("collaborator")
    list = Holiday.create!(name: "Christmas", workspace: leaver.personal_workspace)
    list.holiday_users.create!(user: leaver, role: "owner")
    list.holiday_users.create!(user: collaborator, role: "collaborator")
    delivery = EmailDelivery.log_sent!(user: collaborator, kind: "pending_gifts", subject: "Reminder",
      dedupe_key: "d1", holiday: list)

    AccountDeletionService.delete!(leaver)

    assert_not Holiday.exists?(list.id)
    assert_nil delivery.reload.holiday_id
  end

  test "gifts they added to someone else's list stay, without their name" do
    owner = person("owner")
    leaver = person("leaver")
    list = Holiday.create!(name: "Christmas", workspace: owner.personal_workspace)
    list.holiday_users.create!(user: owner, role: "owner")
    list.holiday_users.create!(user: leaver, role: "collaborator")
    gift = Gift.create!(name: "Scarf", holiday: list, gift_status: gift_statuses(:idea), created_by: leaver)
    change = GiftChange.create!(gift: gift, holiday: list, user: leaver, change_type: :created)

    AccountDeletionService.delete!(leaver)

    assert_nil gift.reload.created_by_user_id
    assert_not GiftChange.exists?(change.id)
    assert list.reload.member?(owner)
  end

  # ============================================================================
  # Wishlists and claims
  # ============================================================================

  test "their own wishlist goes, along with its share link" do
    leaver = person("leaver")
    wishlist = Wishlist.create!(name: "Mine", user: leaver, workspace: leaver.personal_workspace, visibility: "shared")
    token = wishlist.share_token

    AccountDeletionService.delete!(leaver)

    assert_not Wishlist.exists?(share_token: token)
  end

  test "a claim on someone else's wishlist stays held but says nothing about them" do
    owner = person("owner")
    leaver = person("leaver")
    wishlist = Wishlist.create!(name: "Theirs", user: owner, workspace: owner.personal_workspace, visibility: "shared")
    item = wishlist.wishlist_items.create!(name: "Mug")
    claim = item.claims.create!(user: leaver, claimer_name: "Robin Hartley", claimer_email: leaver.email,
      message: "From Robin")

    AccountDeletionService.delete!(leaver)

    claim.reload
    assert_nil claim.user_id
    assert_nil claim.claimer_name
    assert_nil claim.claimer_email
    assert_nil claim.message
    assert_equal 1, item.reload.claimed_quantity, "the item stays spoken for, so nobody buys it twice"
    json = WishlistItemClaimBlueprint.render_as_hash(claim)
    assert_nil json[:claimer][:name]
  end

  test "a claim left behind cannot be picked up through its old guest link" do
    owner = person("owner")
    leaver = person("leaver")
    wishlist = Wishlist.create!(name: "Theirs", user: owner, workspace: owner.personal_workspace, visibility: "shared")
    claim = wishlist.wishlist_items.create!(name: "Mug").claims.create!(user: leaver)

    AccountDeletionService.delete!(leaver)

    assert_nil claim.reload.claim_token
  end

  test "a guest claim made with their email is cleared too" do
    owner = person("owner")
    leaver = person("leaver")
    wishlist = Wishlist.create!(name: "Theirs", user: owner, workspace: owner.personal_workspace, visibility: "shared")
    claim = wishlist.wishlist_items.create!(name: "Mug").claims.create!(claimer_name: "Robin", claimer_email: leaver.email)

    AccountDeletionService.delete!(leaver)

    claim.reload
    assert_nil claim.claimer_email
    assert_nil claim.claimer_name
    assert_nil claim.claim_token
  end

  # ============================================================================
  # Clerk
  # ============================================================================

  test "a Clerk failure leaves every row as it was" do
    leaver = person("leaver")
    relative = person("relative")
    owned = inviting_exchange(leaver, relative, name: "Theirs")
    _, (_organizer_row, leaver_row, *) = drawn_exchange(relative, leaver, person("third"), name: "Relative's")
    @clerk_users.delete_error = RuntimeError.new("Clerk is down")

    assert_raises(AccountDeletionService::ClerkFailed) { AccountDeletionService.delete!(leaver) }

    assert User.exists?(leaver.id)
    assert GiftExchange.exists?(owned.id)
    assert_equal leaver.id, leaver_row.reload.user_id
    assert_equal leaver.email, leaver_row.email
    assert leaver.personal_workspace.present?
  end

  test "relatives hear nothing when Clerk fails and the cancellation rolls back" do
    leaver = person("leaver")
    drawn_exchange(leaver, person("relative"), person("other"))
    @clerk_users.delete_error = RuntimeError.new("Clerk is down")

    assert_no_enqueued_emails do
      assert_raises(AccountDeletionService::ClerkFailed) { AccountDeletionService.delete!(leaver) }
    end
  end

  test "Clerk is left alone when the local delete fails" do
    leaver = person("leaver")
    failure = ActiveRecord::RecordNotDestroyed.new("blocked", leaver)

    leaver.stub(:destroy!, -> { raise failure }) do
      assert_raises(ActiveRecord::RecordNotDestroyed) { AccountDeletionService.delete!(leaver) }
    end

    assert_empty @clerk_users.deletions
    assert User.exists?(leaver.id)
  end

  test "Clerk already having no such user still finishes the deletion" do
    leaver = person("leaver")
    @clerk_users.delete_error = FakeClerkUsers.not_found

    AccountDeletionService.delete!(leaver)

    assert_not User.exists?(leaver.id)
  end

  test "Clerk is asked to fail fast, because the transaction waits on it" do
    leaver = person("leaver")

    AccountDeletionService.delete!(leaver)

    call = @clerk_users.deletions.sole
    assert_operator call[:timeout_ms], :<=, 15_000
    assert_not_equal "backoff", call[:retries].strategy, "the SDK default retries for an hour"
  end

  # ============================================================================
  # Administrators
  # ============================================================================

  test "refuses an allowlisted administrator before touching anything" do
    admin = person("admin")
    relative = person("relative")
    exchange = inviting_exchange(admin, relative)

    with_admin_emails(admin.email) do
      assert_raises(AccountDeletionService::Refused) { AccountDeletionService.delete!(admin) }
    end

    assert User.exists?(admin.id)
    assert GiftExchange.exists?(exchange.id)
    assert_empty @clerk_users.deletions
  end

  test "refuses a former administrator whose audit records still name them" do
    former = person("former")
    AdminAuditEvent.record!(actor: former, action: "user_deletion.preview")

    assert_raises(AccountDeletionService::Refused) { AccountDeletionService.delete!(former) }

    assert User.exists?(former.id)
    assert_empty @clerk_users.deletions
  end

  private

  def analytics_event(visitor, user:, workspace:)
    AnalyticsEvent.create!(analytics_visitor: visitor, user: user, workspace: workspace,
      event_id: SecureRandom.uuid, event_name: "page_view", anonymous_id: visitor.anonymous_id,
      session_id: SecureRandom.hex(8), occurred_at: Time.current, received_at: Time.current)
  end

  def with_admin_emails(value)
    previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = value
    yield
  ensure
    ENV["ADMIN_EMAILS"] = previous
  end
end
