require "test_helper"

class WorkspacesApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @workspace = workspaces(:one)
  end

  # ============================================================================
  # Basic CRUD Tests
  # ============================================================================

  test "index returns workspaces for current user" do
    get workspaces_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
    assert json_response.any? { |w| w["id"] == @workspace.id }
  end

  test "show returns a workspace" do
    get workspace_path(@workspace), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal @workspace.name, json_response["name"]
  end

  test "create creates a business workspace" do
    assert_difference("Workspace.count") do
      post workspaces_path,
        headers: @auth_headers,
        params: { workspace: { name: "New Business", workspace_type: "business" } },
        as: :json
    end
    assert_response :created
    assert_equal "business", Workspace.last.workspace_type
  end

  test "create stores initial business use case on company profile" do
    assert_difference([ "Workspace.count", "CompanyProfile.count" ], 1) do
      post workspaces_path,
        headers: @auth_headers,
        params: {
          workspace: { name: "Holiday Ops", workspace_type: "business" },
          company_name: "Acme Gifts",
          business_use_case: "holiday-box"
        },
        as: :json
    end

    assert_response :created
    profile = Workspace.last.company_profile
    assert_equal "Acme Gifts", profile.name
    assert_equal "holiday-box", profile.tax_metadata["initial_use_case"]
  end

  test "update modifies a workspace" do
    patch workspace_path(@workspace),
      headers: @auth_headers,
      params: { workspace: { name: "Updated Workspace Name" } },
      as: :json
    assert_response :success
    assert_equal "Updated Workspace Name", @workspace.reload.name
  end

  test "destroy removes a workspace" do
    # Create a new business workspace to delete (can't delete personal workspace)
    business_workspace = Workspace.create!(
      name: "Business to Delete",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")

    # Use the workspace header for the delete request
    business_headers = auth_headers_for(@user, workspace: business_workspace)
    assert_difference("Workspace.count", -1) do
      delete workspace_path(business_workspace), headers: business_headers, as: :json
    end
    assert_response :no_content
  end

  test "cannot access workspace user is not a member of" do
    other_workspace = workspaces(:two)
    get workspace_path(other_workspace), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  # ============================================================================
  # Membership Tests
  # ============================================================================

  test "memberships index returns workspace members" do
    get workspace_memberships_path(@workspace), headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
    assert json_response.any? { |m| m["user_id"] == @user.id }
  end

  test "memberships destroy removes a member" do
    # Add a member to remove
    user_two = users(:two)
    membership = @workspace.workspace_memberships.create!(user: user_two, role: "member")

    assert_difference("WorkspaceMembership.count", -1) do
      delete workspace_membership_path(@workspace, membership), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  test "cannot remove yourself from workspace" do
    owner_membership = @workspace.workspace_memberships.find_by(user: @user)
    delete workspace_membership_path(@workspace, owner_membership), headers: @auth_headers, as: :json
    assert_response :unprocessable_entity
  end

  # ============================================================================
  # Workspace Invites Management Tests
  # ============================================================================

  test "invites index returns workspace invites" do
    WorkspaceInvite.create!(
      workspace: @workspace,
      email: "test@example.com",
      role: "member",
      invited_by_id: @user.id
    )

    get workspace_invites_path(@workspace), headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
  end

  test "invites create creates a new invite" do
    assert_difference("WorkspaceInvite.count") do
      post workspace_invites_path(@workspace),
        headers: @auth_headers,
        params: { workspace_invite: { email: "newinvite@example.com", role: "member" } },
        as: :json
    end
    assert_response :created
  end

  test "invites destroy removes an invite" do
    invite = WorkspaceInvite.create!(
      workspace: @workspace,
      email: "todelete@example.com",
      role: "member",
      invited_by_id: @user.id
    )

    assert_difference("WorkspaceInvite.count", -1) do
      delete workspace_invite_path(@workspace, invite), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  test "invites regenerate creates new invite link" do
    post regenerate_workspace_invites_path(@workspace),
      headers: @auth_headers,
      params: { role: "member" },
      as: :json
    assert_response :success
  end

  # ============================================================================
  # Workspace Invite Token Access Tests
  # ============================================================================

  test "workspace invite show returns invite details by token" do
    invite = WorkspaceInvite.create!(
      workspace: @workspace,
      email: "invitee@example.com",
      role: "member",
      invited_by_id: @user.id
    )

    # Public endpoint, no auth needed
    get "/workspace_invite/#{invite.token}", as: :json
    assert_response :success
    assert_equal @workspace.name, json_response["workspace"]["name"]
  end

  test "workspace invite accept joins workspace" do
    invite = WorkspaceInvite.create!(
      workspace: @workspace,
      email: "bob@example.com",
      role: "member",
      invited_by_id: @user.id
    )

    user_two = users(:two)
    user_two_headers = auth_headers_for(user_two)

    assert_difference("WorkspaceMembership.count") do
      post "/workspace_invite/#{invite.token}/accept", headers: user_two_headers, as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Address Tests (Business Workspace Only)
  # ============================================================================

  test "addresses require business workspace" do
    # Personal workspace should fail
    get workspace_addresses_path(@workspace), headers: @auth_headers, as: :json
    assert_response :unprocessable_entity
  end

  test "addresses index returns addresses for business workspace" do
    # Create a business workspace with company profile and address
    business_workspace = Workspace.create!(
      name: "Business Workspace",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    company_profile = business_workspace.create_company_profile!(name: "Test Company")
    address = company_profile.addresses.create!(
      label: "Office",
      street_line_1: "123 Main St",
      city: "Toronto",
      postal_code: "M5V1A1",
      country: "CA"
    )

    business_headers = auth_headers_for(@user, workspace: business_workspace)
    get workspace_addresses_path(business_workspace), headers: business_headers, as: :json
    assert_response :success
    assert json_response.any? { |a| a["id"] == address.id }
  end

  test "addresses create adds a new address to business workspace" do
    business_workspace = Workspace.create!(
      name: "Business Workspace",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    business_workspace.create_company_profile!(name: "Test Company")

    business_headers = auth_headers_for(@user, workspace: business_workspace)
    assert_difference("Address.count") do
      post workspace_addresses_path(business_workspace),
        headers: business_headers,
        params: {
          address: {
            label: "Warehouse",
            street_line_1: "456 Industrial Ave",
            city: "Vancouver",
            postal_code: "V6B1A1",
            country: "CA"
          }
        },
        as: :json
    end
    assert_response :created
  end

  test "addresses update modifies an address" do
    business_workspace = Workspace.create!(
      name: "Business Workspace",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    company_profile = business_workspace.create_company_profile!(name: "Test Company")
    address = company_profile.addresses.create!(
      label: "Office",
      street_line_1: "123 Main St",
      city: "Toronto",
      postal_code: "M5V1A1",
      country: "CA"
    )

    business_headers = auth_headers_for(@user, workspace: business_workspace)
    patch workspace_address_path(business_workspace, address),
      headers: business_headers,
      params: { address: { label: "Head Office" } },
      as: :json
    assert_response :success
    assert_equal "Head Office", address.reload.label
  end

  test "addresses destroy removes an address" do
    business_workspace = Workspace.create!(
      name: "Business Workspace",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    company_profile = business_workspace.create_company_profile!(name: "Test Company")
    address = company_profile.addresses.create!(
      label: "Office",
      street_line_1: "123 Main St",
      city: "Toronto",
      postal_code: "M5V1A1",
      country: "CA"
    )

    business_headers = auth_headers_for(@user, workspace: business_workspace)
    assert_difference("Address.count", -1) do
      delete workspace_address_path(business_workspace, address), headers: business_headers, as: :json
    end
    assert_response :success
  end

  test "addresses set_default marks address as default" do
    business_workspace = Workspace.create!(
      name: "Business Workspace",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    company_profile = business_workspace.create_company_profile!(name: "Test Company")
    address = company_profile.addresses.create!(
      label: "Office",
      street_line_1: "123 Main St",
      city: "Toronto",
      postal_code: "M5V1A1",
      country: "CA",
      is_default: false
    )

    business_headers = auth_headers_for(@user, workspace: business_workspace)
    post set_default_workspace_address_path(business_workspace, address),
      headers: business_headers,
      as: :json
    assert_response :success
    assert address.reload.is_default
  end

  # ============================================================================
  # Authentication Tests
  # ============================================================================

  test "requires authentication" do
    get workspaces_path, as: :json
    assert_response :unauthorized
  end
end
