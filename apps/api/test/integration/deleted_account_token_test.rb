require "test_helper"
require "support/account_deletion_test_helpers"

class DeletedAccountTokenTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper
  include AccountDeletionTestHelpers

  setup do
    @old_queue_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    clear_enqueued_jobs
  end

  teardown do
    clear_enqueued_jobs
    ActiveJob::Base.queue_adapter = @old_queue_adapter
  end

  test "a token that outlives the account cannot bring it back or send a welcome email" do
    leaver = person("leaver")
    headers = auth_headers_for(leaver)
    delete "/profile?confirmation=DELETE", headers: headers
    assert_response :no_content
    clear_enqueued_jobs

    assert_no_difference "User.count" do
      get "/bootstrap", headers: headers
    end

    assert_response :unauthorized
    assert_no_enqueued_jobs only: SendWelcomeEmailJob
  end

  test "a Clerk outage still lets a new person sign up" do
    @clerk_users.define_singleton_method(:get) { |user_id:| raise "Clerk is down" }
    token = "new_person_token"
    mock_clerk_token(token, { "sub" => "user_brand_new", "email" => "brand-new@example.com" })

    get "/bootstrap", headers: { "Authorization" => "Bearer #{token}" }

    assert_response :success
    assert User.exists?(clerk_user_id: "user_brand_new")
  end
end
