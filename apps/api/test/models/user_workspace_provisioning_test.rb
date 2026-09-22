require "test_helper"
require_relative "../support/database_lock_assertions"

class UserWorkspaceProvisioningTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  include DatabaseLockAssertions

  test "a long display name still receives a valid personal workspace" do
    user = User.create!(email: "long-name-#{SecureRandom.hex(8)}@example.com", first_name: "A" * 200, clerk_user_id: "long_name_#{SecureRandom.hex(8)}")
    workspace = user.ensure_personal_workspace!
    assert_equal 200, workspace.name.length
    assert workspace.owner?(user)
  ensure
    Workspace.where(created_by_user: user).destroy_all if user
    user&.destroy!
  end

  test "concurrent workspace provisioning reuses the workspace created under the user lock" do
    skip "Row-lock regression requires PostgreSQL" unless ActiveRecord::Base.connection.adapter_name == "PostgreSQL"
    suffix = SecureRandom.hex(8)
    user = User.create!(email: "provision-#{suffix}@example.com", clerk_user_id: "provision_#{suffix}")
    first = nil
    second = nil

    assert_waiting_mutation(user, -> { second = User.find(user.id).ensure_personal_workspace! }) do
      first = user.ensure_personal_workspace!
    end

    assert_equal first.id, second.id
    assert_equal 1, user.workspaces.count
    assert first.owner?(user)
  ensure
    Workspace.where(created_by_user: user).destroy_all if user
    user&.destroy!
  end
end
