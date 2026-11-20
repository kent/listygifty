require "test_helper"
require "minitest/mock"

# Every query costs a database round trip in production, so /bootstrap's query
# count must not grow with the user's workspaces or an exchange's participants,
# and authenticating an existing user must not open a transaction.
class BootstrapQueryCountTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @user.update!(first_name: "Alice", image_url: "https://example.com/alice.png")
    @workspace = workspaces(:one)
  end

  test "an existing user is authenticated without a transaction" do
    headers = auth_headers_for(@user)

    User.stub(:transaction, ->(*) { flunk "opened a transaction for an existing user" }) do
      get "/bootstrap", headers: headers
    end

    assert_response :success
    assert_equal @workspace.id, json_response["current_workspace_id"]
  end

  test "a user with a profile to sync from Clerk still goes through the transaction" do
    @user.update!(image_url: nil, clerk_profile_synced_at: 2.days.ago)
    mock_clerk_user_fetch(@user.clerk_user_id, @user.email)

    get "/bootstrap", headers: auth_headers_for(@user)

    assert_response :success
    assert_in_delta Time.current, @user.reload.clerk_profile_synced_at, 1.minute
  end

  test "query count does not grow with workspaces or exchange participants" do
    exchange = GiftExchange.create!(workspace: @workspace, user: @user, name: "Family Secret Santa", status: "active")
    organizer = exchange.exchange_participants.create!(user: @user, name: "Alice", email: @user.email, status: "accepted")
    add_participant(exchange, "jordan", matched_to: organizer)
    add_workspace("Side Project")

    baseline = bootstrap_query_count

    add_participant(exchange, "sam")
    add_participant(exchange, "riley")
    add_workspace("Second Shop")
    add_workspace("Third Shop")

    assert_equal baseline, bootstrap_query_count
  end

  test "workspace roles and counts come from the preloaded memberships" do
    business = add_workspace("Side Project", role: "admin")
    business.workspace_memberships.create!(user: users(:two), role: "owner")

    workspaces = BootstrapPayloadService.new(user: @user).call[:workspaces].index_by { |workspace| workspace[:id] }

    assert_equal [ true, true, "owner" ], workspaces[@workspace.id].values_at(:is_owner, :is_admin, :role)
    assert_equal [ false, true, "admin", 2 ], workspaces[business.id].values_at(:is_owner, :is_admin, :role, :member_count)
  end

  test "gift totals match counting each scope separately" do
    payload = BootstrapPayloadService.new(user: @user, workspace_id: @workspace.id).call[:data]
    gifts = Gift.where(holiday_id: @user.holidays_in_workspace(@workspace).user_holidays.select(:id))

    assert gifts.count.positive?, "fixtures should give the workspace gifts"
    assert_equal gifts.count, payload[:gift_total]
    assert_equal gifts.where.not(gift_status_id: GiftStatus.completed_ids).count, payload[:pending_gift_total]
  end

  test "static data is checked at most once a minute and picks up edits after that" do
    with_memory_cache do
      BootstrapPayloadService.cached_gift_statuses
      BootstrapPayloadService.cached_completed_gift_status_ids

      assert_no_queries_match(/gift_statuses/) do
        uncached do
          BootstrapPayloadService.cached_gift_statuses
          BootstrapPayloadService.cached_completed_gift_status_ids
        end
      end

      status = GiftStatus.order(:position).first
      status.update!(name: "Renamed status")

      travel BootstrapPayloadService::STATIC_KEY_EXPIRES_IN + 1.second do
        names = BootstrapPayloadService.cached_gift_statuses.map { |row| row[:name] }
        assert_includes names, "Renamed status"
      end
    end
  end

  private

  def bootstrap_query_count
    user = User.find(@user.id)
    count = 0
    counter = lambda do |*, payload|
      count += 1 unless payload[:cached] || %w[SCHEMA TRANSACTION].include?(payload[:name])
    end

    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
      uncached { BootstrapPayloadService.new(user: user, workspace_id: @workspace.id).call.to_json }
    end
    count
  end

  def add_participant(exchange, name, matched_to: nil)
    user = User.create!(email: "#{name}@example.com", clerk_user_id: "user_#{name}", first_name: name.capitalize, subscription_plan: "free")
    wishlist = user.default_wishlist!
    wishlist.wishlist_items.create!(name: "Something for #{name}")
    participant = exchange.exchange_participants.create!(user: user, name: name.capitalize, email: user.email, status: "accepted", wishlist: wishlist)
    matched_to&.update!(matched_participant: participant)
    participant
  end

  def add_workspace(name, role: "owner")
    workspace = Workspace.create!(name: name, workspace_type: "business", created_by_user: @user)
    workspace.workspace_memberships.create!(user: @user, role: role)
    workspace
  end

  def with_memory_cache
    original = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    yield
  ensure
    Rails.cache = original
  end

  def uncached(&) = ActiveRecord::Base.uncached(&)
end
