require "test_helper"
require "support/account_deletion_test_helpers"

class AccountDeletionApiTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper
  include AccountDeletionTestHelpers

  CONFIRMED = "/profile?confirmation=DELETE".freeze

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    @leaver = person("leaver", first_name: "Robin", last_name: "Hartley")
    @headers = auth_headers_for(@leaver)
  end

  teardown do
    ActionMailer::Base.deliveries.clear
    clear_enqueued_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
  end

  test "deletes the signed-in account and its Clerk user" do
    delete CONFIRMED, headers: @headers

    assert_response :no_content
    assert_not User.exists?(@leaver.id)
    assert_equal [ @leaver.clerk_user_id ], @clerk_users.deleted_user_ids
  end

  test "a stray DELETE without the confirmation changes nothing" do
    delete "/profile", headers: @headers

    assert_response :unprocessable_entity
    assert_match(/confirm/i, json_response["error"])
    assert User.exists?(@leaver.id)
    assert_empty @clerk_users.deletions
  end

  test "a confirmation that does not match changes nothing" do
    [ "true", "delete", "1", "" ].each do |value|
      delete "/profile?confirmation=#{value}", headers: @headers

      assert_response :unprocessable_entity
    end

    assert User.exists?(@leaver.id)
    assert_empty @clerk_users.deletions
  end

  test "a signed-out request is rejected" do
    delete CONFIRMED

    assert_response :unauthorized
    assert User.exists?(@leaver.id)
    assert_empty @clerk_users.deletions
  end

  test "an API key cannot delete the account it belongs to" do
    raw_key = ApiKey.generate_for(@leaver, name: "Laptop").raw_key

    delete CONFIRMED, headers: { "Authorization" => "Bearer #{raw_key}" }

    assert_response :unauthorized
    assert User.exists?(@leaver.id)
    assert_empty @clerk_users.deletions
  end

  test "a Clerk failure returns an error and leaves a working account" do
    relative = person("relative")
    owned, = drawn_exchange(@leaver, relative, person("other"), name: "Theirs")
    @clerk_users.delete_error = RuntimeError.new("Clerk is down")

    assert_no_enqueued_emails do
      delete CONFIRMED, headers: @headers
    end

    assert_response :bad_gateway
    assert_match(/nothing has changed/i, json_response["error"])
    assert GiftExchange.exists?(owned.id)

    get "/bootstrap", headers: @headers

    assert_response :success
  end

  test "an administrator gets a clear refusal" do
    AdminAuditEvent.record!(actor: @leaver, action: "user_deletion.preview")

    delete CONFIRMED, headers: @headers

    assert_response :unprocessable_entity
    assert_match(/admin/i, json_response["error"])
    assert_no_match(/—/, json_response["error"])
    assert User.exists?(@leaver.id)
  end

  test "the person who drew them can still open their match" do
    organizer = person("organizer")
    giver = person("giver")
    exchange = GiftExchange.create!(name: "Family", user: organizer, workspace: organizer.personal_workspace, status: "inviting")
    join_exchange(exchange, organizer)
    giver_row = join_exchange(exchange, giver)
    leaver_row = join_exchange(exchange, @leaver)
    giver_row.update!(matched_participant: leaver_row)
    leaver_row.update!(matched_participant: giver_row)
    exchange.update!(status: "active", published_at: Time.current)

    delete CONFIRMED, headers: @headers
    assert_response :no_content

    get "/gift_exchanges/#{exchange.slug}", headers: auth_headers_for(giver)
    assert_response :success
    match = json_response.dig("my_participant", "matched_participant")
    assert_equal leaver_row.id, match["id"]
    assert_equal "Robin", match["display_name"]
    assert_equal "", match["email"]
    assert_not exchange.reload.capabilities_for(giver)[:nudge_match]

    get "/gift_exchanges/#{exchange.slug}", headers: auth_headers_for(organizer)
    assert_response :success
    row = json_response["exchange_participants"].find { |participant| participant["id"] == leaver_row.id }
    assert_equal "", row["email"]
    assert_nil row["user_id"]
  end

  test "relatives in an exchange they ran hear that it is cancelled" do
    relative = person("relative")
    other = person("other")
    drawn_exchange(@leaver, relative, other, name: "Holiday Draw")

    perform_enqueued_jobs do
      delete CONFIRMED, headers: @headers
    end

    assert_response :no_content
    cancellations = ActionMailer::Base.deliveries.select { |mail| mail.subject.include?("Cancelled: Holiday Draw") }
    assert_equal [ relative.email, other.email ].sort, cancellations.flat_map(&:to).sort
  end

  test "another member keeps using a workspace they created" do
    member = person("member")
    workspace = Workspace.create!(name: "Family", workspace_type: "business", created_by_user: @leaver)
    workspace.workspace_memberships.create!(user: @leaver, role: "owner")
    share_workspace(workspace, member)

    delete CONFIRMED, headers: @headers
    assert_response :no_content

    get "/workspaces/#{workspace.id}", headers: auth_headers_for(member, workspace: workspace)

    assert_response :success
    assert_equal "owner", workspace.reload.role_for(member)
  end

  test "their public wishlist link stops working" do
    wishlist = Wishlist.create!(name: "Mine", user: @leaver, workspace: @leaver.personal_workspace, visibility: "shared")
    token = wishlist.share_token
    get "/w/#{token}"
    assert_response :success

    delete CONFIRMED, headers: @headers
    assert_response :no_content

    get "/w/#{token}"
    assert_response :not_found
  end
end
