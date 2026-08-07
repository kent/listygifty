ENV["RAILS_ENV"] ||= "test"
# Skip Clerk middleware in tests - we mock token verification
ENV["CLERK_SKIP_RAILTIE"] ||= "1"
# Set dummy Clerk secret key for tests to avoid ConfigurationError
ENV["CLERK_SECRET_KEY"] ||= "sk_test_dummy_key_for_testing"

require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # All workers share one PostgreSQL test database and fixture IDs. Process
    # parallelism races fixture reloads with explicit User row-lock concurrency
    # regressions, producing nondeterministic deadlocks and FK failures. Keep the
    # documented default deterministic; individual tests still exercise threads.
    parallelize(workers: ENV.fetch("PARALLEL_WORKERS", "1").to_i)
    fixtures :all
  end
end

module ActionDispatch
  class IntegrationTest
    def json_response
      JSON.parse(response.body)
    end

    def auth_headers_for(user, workspace: nil)
      # Store the expected payload for this user
      token = "valid_token_#{user.id}"
      mock_clerk_token(token, { "sub" => user.clerk_user_id, "email" => user.email })
      headers = { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" }
      # Include workspace header if provided or if user has a personal workspace
      ws = workspace || user.personal_workspace
      headers["X-Workspace-ID"] = ws.id.to_s if ws
      headers
    end

    def mock_clerk_token(token, payload)
      # Mock Clerk::SDK instance verify_token method
      Clerk::SDK.class_eval do
        @@test_tokens ||= {}
        @@test_tokens[token] = payload

        define_method(:verify_token) do |t|
          if @@test_tokens[t]
            @@test_tokens[t]
          else
            raise Clerk::AuthenticationError, "Invalid token"
          end
        end
      end
    end

    def mock_clerk_user_fetch(clerk_id, email)
      # Mock Clerk::SDK to return a user with the specified email
      # Store test users in a class variable
      Clerk::SDK.class_variable_set(:@@test_users, {}) unless Clerk::SDK.class_variable_defined?(:@@test_users)
      Clerk::SDK.class_variable_get(:@@test_users)[clerk_id] = email

      # Override the users method on the Clerk::SDK class itself
      # This will apply to all instances
      unless Clerk::SDK.instance_methods(false).include?(:original_users_for_test)
        Clerk::SDK.class_eval do
          alias_method :original_users_for_test, :users

          def users
            test_users = self.class.class_variable_get(:@@test_users) rescue {}
            # Return a mock users object matching the current Clerk SDK contract.
            users_obj = Object.new
            users_obj.define_singleton_method(:get) do |user_id:|
              if test_users[user_id.to_s]
                user_email = test_users[user_id.to_s]
                # Create a mock user object
                user_obj = Object.new
                user_obj.define_singleton_method(:email_addresses) do
                  [ { "id" => "email_1", "email_address" => user_email } ]
                end
                user_obj.define_singleton_method(:primary_email_address_id) { "email_1" }
                user_obj.define_singleton_method(:first_name) { nil }
                user_obj.define_singleton_method(:last_name) { nil }
                user_obj.define_singleton_method(:image_url) { nil }
                user_obj.define_singleton_method(:username) { nil }
                user_obj.define_singleton_method(:phone_numbers) { [] }
                response = Object.new
                response.define_singleton_method(:user) { user_obj }
                response
              else
                # Fall back to original if not in test users
                original_users_for_test.get(user_id: user_id)
              end
            end
            users_obj
          end
        end
      end
    end

    def create_test_user(email: "test@example.com", clerk_id: "user_test_123")
      user = User.create!(
        email: email,
        clerk_user_id: clerk_id,
        subscription_plan: "free"
      )
      # Create personal workspace for test user
      workspace = Workspace.create!(
        name: "#{user.email}'s Workspace",
        workspace_type: "personal",
        created_by_user: user
      )
      workspace.workspace_memberships.create!(user: user, role: "owner")
      user
    end
  end
end
