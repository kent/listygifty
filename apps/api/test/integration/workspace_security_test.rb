require "test_helper"

class WorkspaceSecurityTest < ActionDispatch::IntegrationTest
  setup do
    @workspace = workspaces(:one)
    @owner = users(:one)
    @other = users(:two)
    @owner_headers = auth_headers_for(@owner, workspace: @workspace)
  end

  test "an admin cannot promote themselves to owner" do
    membership = @workspace.workspace_memberships.create!(user: @other, role: "admin")
    patch workspace_membership_path(@workspace, membership),
      headers: auth_headers_for(@other, workspace: @workspace),
      params: { workspace_membership: { role: "owner" } }, as: :json

    assert_response :forbidden
    assert_equal "admin", membership.reload.role
  end

  test "an admin cannot remove an owner even when another owner exists" do
    admin = create_test_user(email: "admin@example.com", clerk_id: "workspace_admin")
    @workspace.workspace_memberships.create!(user: admin, role: "admin")
    @workspace.workspace_memberships.create!(user: @other, role: "owner")
    membership = @workspace.workspace_memberships.find_by!(user: @owner)

    assert_no_difference("WorkspaceMembership.count") do
      delete workspace_membership_path(@workspace, membership),
        headers: auth_headers_for(admin, workspace: @workspace), as: :json
    end
    assert_response :forbidden
  end

  test "an owner can promote a member to owner" do
    membership = @workspace.workspace_memberships.create!(user: @other, role: "member")
    patch workspace_membership_path(@workspace, membership), headers: @owner_headers,
      params: { workspace_membership: { role: "owner" } }, as: :json

    assert_response :success
    assert membership.reload.owner?
  end

  test "invalid membership roles produce a validation response" do
    membership = @workspace.workspace_memberships.create!(user: @other, role: "member")
    patch workspace_membership_path(@workspace, membership), headers: @owner_headers,
      params: { workspace_membership: { role: "invalid" } }, as: :json

    assert_response :unprocessable_entity
    assert membership.reload.member?
  end

  test "ordinary members cannot obtain invitation credentials" do
    @workspace.workspace_memberships.create!(user: @other, role: "member")
    @workspace.workspace_invites.create!(invited_by: @owner, role: "admin")
    get workspace_invites_path(@workspace),
      headers: auth_headers_for(@other, workspace: @workspace), as: :json

    assert_response :forbidden
  end

  test "an invitation addressed to one email cannot be accepted by another user" do
    invite = @workspace.workspace_invites.create!(
      invited_by: @owner, role: "admin", email: "intended@example.com"
    )
    assert_no_difference("WorkspaceMembership.count") do
      post "/workspace_invite/#{invite.token}/accept", headers: auth_headers_for(@other), as: :json
    end

    assert_response :unprocessable_entity
    assert_not invite.reload.accepted?
  end

  test "an addressed invitation accepts a case-insensitive matching email" do
    invite = @workspace.workspace_invites.create!(
      invited_by: @owner, role: "member", email: @other.email.upcase
    )
    post "/workspace_invite/#{invite.token}/accept", headers: auth_headers_for(@other), as: :json

    assert_response :created
    assert invite.reload.accepted?
  end

  test "a shared invitation without an email can be accepted" do
    invite = @workspace.workspace_invites.create!(invited_by: @owner, role: "member")
    post "/workspace_invite/#{invite.token}/accept", headers: auth_headers_for(@other), as: :json

    assert_response :created
  end

  test "failed invitation regeneration does not expire valid links" do
    invite = @workspace.workspace_invites.create!(invited_by: @owner, role: "member")
    post regenerate_workspace_invites_path(@workspace), headers: @owner_headers,
      params: { role: "owner" }, as: :json

    assert_response :unprocessable_entity
    assert invite.reload.valid_invite?
  end
end
