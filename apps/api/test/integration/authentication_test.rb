require "test_helper"

class AuthenticationTest < ActionDispatch::IntegrationTest
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
