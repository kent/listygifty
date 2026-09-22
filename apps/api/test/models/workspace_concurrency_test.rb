require "test_helper"
require_relative "../support/database_lock_assertions"

class WorkspaceConcurrencyTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  include DatabaseLockAssertions

  setup do
    skip "Row-lock regression requires PostgreSQL" unless ActiveRecord::Base.connection.adapter_name == "PostgreSQL"
    @users = 2.times.map do
      suffix = SecureRandom.hex(8)
      User.create!(email: "workspace-race-#{suffix}@example.com", clerk_user_id: "workspace_race_#{suffix}")
    end
    @workspace = Workspace.create!(name: "Concurrent owners", workspace_type: "business", created_by_user: @users.first)
    @owners = @users.map { |user| @workspace.workspace_memberships.create!(user: user, role: "owner") }
  end

  teardown do
    @workspace&.destroy!
    @users&.each(&:destroy!)
  end

  [ :demote, :destroy ].each do |action|
    test "#{action} serializes the last-owner check with other membership changes" do
      result = nil
      assert_waiting_mutation(@workspace, -> {
        membership = WorkspaceMembership.find(@owners.last.id)
        result = action == :demote ? membership.update(role: "member") : membership.destroy
      }) do
        assert @owners.first.update(role: "member")
      end

      assert_not result
      assert_equal [ @owners.last.id ], @workspace.workspace_memberships.where(role: "owner").pluck(:id)
    end
  end

  test "a stale member instance cannot remove a newly promoted sole owner" do
    @owners.first.update!(role: "member")
    stale = WorkspaceMembership.find(@owners.first.id)
    @owners.first.update!(role: "owner")
    @owners.last.update!(role: "member")

    assert_not stale.destroy
    assert @owners.first.reload.owner?
  end

  test "invitation acceptance waits for regeneration and rechecks expiration" do
    @owners.last.destroy!
    invite = @workspace.workspace_invites.create!(invited_by: @users.first, role: "member")
    accepted = nil
    assert_waiting_mutation(@workspace, -> { accepted = WorkspaceInvite.find(invite.id).accept!(@users.last) }) do
      @workspace.workspace_invites.valid.update_all(expires_at: Time.current)
    end

    assert_not accepted
    assert_not @workspace.member?(@users.last)
    assert_not invite.reload.accepted?
  end

  test "accepting a revoked invitation returns false" do
    @owners.last.destroy!
    invite = @workspace.workspace_invites.create!(invited_by: @users.first, role: "member")
    WorkspaceInvite.find(invite.id).destroy!

    assert_not invite.accept!(@users.last)
    assert_not @workspace.member?(@users.last)
  end
end
