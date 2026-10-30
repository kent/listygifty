require "test_helper"

class AuthenticationTest < ActionDispatch::IntegrationTest
  test "authentication repairs an account with no personal workspace" do
    user = User.create!(email: "repair@example.com", clerk_user_id: "repair_workspace", clerk_profile_synced_at: Time.current)
    get holidays_path, headers: auth_headers_for(user), as: :json

    assert_response :success
    assert user.personal_workspace.owner?(user)
    assert_equal 1, user.workspaces.personal.count
  end

  test "failed initial workspace provisioning rolls back the new user" do
    clerk_id = "failed_workspace_provision"
    token = "failed_provision_token"
    mock_clerk_token(token, { "sub" => clerk_id, "email" => "failed-provision@example.com" })
    mock_clerk_user_fetch(clerk_id, "failed-provision@example.com")
    reject_workspace = ->(workspace) do
      workspace.errors.add(:name, "cannot provision") if workspace.created_by_user&.clerk_user_id == clerk_id
    end
    Workspace.validate(reject_workspace)

    assert_no_difference("User.count") do
      assert_no_difference("Workspace.count") do
        get holidays_path, headers: { "Authorization" => "Bearer #{token}" }, as: :json
      end
    end
    assert_response :unauthorized
  ensure
    Workspace.skip_callback(:validate, :before, reject_workspace) if reject_workspace
  end

  test "protected routes require authentication" do
    get holidays_path, as: :json
    assert_response :unauthorized
  end

  test "protected routes accessible with valid token" do
    user = create_test_user

    headers = auth_headers_for(user)
    get holidays_path, headers: headers, as: :json

    assert_response :success
  end

  test "user is auto-created if not exists" do
    # Simulate a valid Clerk token for a user not in our DB
    clerk_id = "user_new_456"
    email = "new@example.com"

    mock_clerk_token("some_valid_token", { "sub" => clerk_id, "email" => email })
    mock_clerk_user_fetch(clerk_id, email)

    # Ensure user doesn't already exist
    User.where(clerk_user_id: clerk_id).destroy_all

    assert_difference("User.count", 1) do
      get holidays_path, headers: { "Authorization" => "Bearer some_valid_token" }, as: :json
    end

    assert_response :success
    new_user = User.find_by(clerk_user_id: clerk_id)
    assert_not_nil new_user
    assert_equal email, new_user.email
    assert_not_nil new_user.clerk_profile_synced_at
  end

  test "recent Clerk profile sync attempts are not repeated on every request" do
    user = create_test_user
    user.update!(
      first_name: nil,
      image_url: nil,
      clerk_profile_synced_at: Time.current
    )
    headers = auth_headers_for(user)
    original_users = Clerk::SDK.instance_method(:users)

    Clerk::SDK.define_method(:users) do
      raise "Clerk user fetch should not run for recently synced profiles"
    end

    get holidays_path, headers: headers, as: :json

    assert_response :success
  ensure
    Clerk::SDK.define_method(:users, original_users) if original_users
  end
end

# Real requests on real threads. Each one needs its own connection, so that what
# one commits is what the other sees, exactly as two Puma threads would.
class AuthenticationRaceTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  self.use_transactional_tests = false

  setup do
    @threads = []
    @original_users = Clerk::SDK.instance_method(:users)
    @clerk_id = "race_#{SecureRandom.hex(8)}"
    @email = "#{@clerk_id}@example.com"
    token = "race_token_#{@clerk_id}"
    @headers = { "Authorization" => "Bearer #{token}" }
    mock_clerk_token(token, { "sub" => @clerk_id, "email" => @email })
  end

  teardown do
    @threads.each(&:join)
    Clerk::SDK.define_method(:users, @original_users)
    @exchange&.destroy!
    User.where(clerk_user_id: @clerk_id).find_each do |user|
      Workspace.where(created_by_user: user).destroy_all
      user.destroy!
    end
  end

  test "the loser of the first sign-in race carries on as the winner's user" do
    @exchange = GiftExchange.create!(
      workspace: workspaces(:one), user: users(:one), name: "Race Santa", status: "inviting"
    )
    invite = @exchange.exchange_participants.create!(name: "New Person", email: @email, status: "invited")
    fetches = hold_clerk_fetches
    finished = Queue.new
    start_request(finished, :get, holidays_path)
    start_request(finished, :post, "/exchange_invite/#{invite.invite_token}/accept")

    # Both requests have missed the row. The second validates only after the
    # first has committed, which is what produced the 401.
    first, second = 2.times.map { fetches.pop(timeout: 10) }
    statuses = nil
    assert_enqueued_jobs 1, only: SendWelcomeEmailJob do
      first << true
      statuses = [ finished.pop(timeout: 10) ]
      second << true
      statuses << finished.pop(timeout: 10)
      @threads.each(&:join)
    end

    assert_equal [ 200, 200 ], statuses
    user = User.find_by!(clerk_user_id: @clerk_id)
    assert_equal 1, User.where(email: @email).count
    assert_equal 1, user.workspaces.personal.count
    assert_equal user, invite.reload.user
    assert_equal "accepted", invite.status
  end

  test "a burst of first requests creates one user and every request succeeds" do
    fetches = hold_clerk_fetches
    finished = Queue.new
    4.times { start_request(finished, :get, holidays_path) }

    gates = 4.times.map { fetches.pop(timeout: 10) }
    statuses = nil
    assert_enqueued_jobs 1, only: SendWelcomeEmailJob do
      gates.each { |gate| gate << true }
      statuses = 4.times.map { finished.pop(timeout: 10) }
      @threads.each(&:join)
    end

    assert_equal [ 200 ] * 4, statuses
    assert_equal 1, User.where(clerk_user_id: @clerk_id).count
    assert_equal 1, User.find_by!(clerk_user_id: @clerk_id).workspaces.personal.count
  end

  test "an email already held by another account is still refused" do
    taken = User.create!(email: "taken-#{@clerk_id}@example.com", clerk_user_id: "other_#{@clerk_id}")
    other_token = "taken_token_#{@clerk_id}"
    mock_clerk_token(other_token, { "sub" => @clerk_id, "email" => taken.email })

    assert_no_difference("User.count") do
      get holidays_path, headers: { "Authorization" => "Bearer #{other_token}" }, as: :json
    end
    assert_response :unauthorized
  ensure
    taken&.destroy!
  end

  test "concurrent requests repairing a missing workspace create only one" do
    user = User.create!(email: @email, clerk_user_id: @clerk_id, clerk_profile_synced_at: Time.current)
    finished = Queue.new

    # Holding the row lets both requests pass the unlocked workspace check and
    # queue on the lock, so neither can see the other's workspace early.
    user.with_lock do
      2.times { start_request(finished, :get, holidays_path) }
      wait_for_blocked_requests(2)
    end

    assert_equal [ 200, 200 ], 2.times.map { finished.pop(timeout: 10) }
    assert_equal 1, user.workspaces.personal.count
    assert_equal 1, WorkspaceMembership.where(user: user).count
  end

  private

  # The Clerk fetch sits between missing the user row and inserting it, so
  # holding it there lets a test choose the order requests reach the insert.
  def hold_clerk_fetches
    fetches = Queue.new
    Clerk::SDK.define_method(:users) do
      clerk_users = Object.new
      clerk_users.define_singleton_method(:get) do |user_id:|
        gate = Queue.new
        fetches << gate
        gate.pop(timeout: 10)
        raise "Clerk is unavailable, so the token email is used"
      end
      clerk_users
    end
    fetches
  end

  def start_request(finished, verb, path)
    session = open_session
    @threads << Thread.new do
      session.public_send(verb, path, headers: @headers, as: :json)
      finished << session.response.status
    end
  end

  # pg_locks, because pg_stat_activity is frozen for the length of a transaction
  # and this polls from inside one.
  def wait_for_blocked_requests(count)
    deadline = 10.seconds.from_now
    loop do
      blocked = ActiveRecord::Base.uncached do
        ActiveRecord::Base.connection.select_value("SELECT count(*) FROM pg_locks WHERE NOT granted")
      end
      break if blocked >= count
      flunk "Requests never queued on the row lock" if Time.current > deadline
      sleep 0.01
    end
  end
end
