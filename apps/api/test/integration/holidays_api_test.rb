require "test_helper"

class HolidaysApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
  end

  test "index returns holidays" do
    get holidays_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_not_nil json_response
  end

  test "show returns a holiday" do
    holiday = holidays(:christmas)
    get holiday_path(holiday), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal holiday.name, json_response["name"]
  end

  test "create creates a holiday" do
    assert_difference("Holiday.count") do
      post holidays_path,
        headers: @auth_headers,
        params: { holiday: { name: "New Holiday", date: "2025-01-01" } },
        as: :json
    end
    assert_response :created
  end

  test "update modifies a holiday" do
    holiday = holidays(:christmas)
    patch holiday_path(holiday),
      headers: @auth_headers,
      params: { holiday: { name: "Updated Holiday" } },
      as: :json
    assert_response :success
    assert_equal "Updated Holiday", holiday.reload.name
  end

  test "destroy removes a holiday" do
    holiday = holidays(:christmas)
    assert_difference("Holiday.count", -1) do
      delete holiday_path(holiday), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Templates Tests
  # ============================================================================

  test "templates returns template holidays" do
    get templates_holidays_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
  end

  test "templates reflects template changes after the cached payload is populated" do
    Holiday.create!(name: "Template A", date: "2026-01-01", is_template: true)

    get templates_holidays_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_includes json_response.pluck("name"), "Template A"

    Holiday.create!(name: "Template B", date: "2026-02-01", is_template: true)

    get templates_holidays_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_includes json_response.pluck("name"), "Template B"
  end

  # ============================================================================
  # Share and Join Tests
  # ============================================================================

  test "share GET returns share link" do
    holiday = holidays(:christmas)
    get share_holiday_path(holiday), headers: @auth_headers, as: :json
    assert_response :success
    assert json_response["share_token"].present? || json_response["share_url"].present?
  end

  test "share POST generates new share link" do
    holiday = holidays(:christmas)
    post share_holiday_path(holiday), headers: @auth_headers, as: :json
    assert_response :success
    assert json_response["share_token"].present? || json_response["share_url"].present?
  end

  test "join adds user as collaborator" do
    # Create a holiday with share token
    @workspace = workspaces(:one)
    shared_holiday = Holiday.create!(
      name: "Shared Holiday",
      workspace: @workspace,
      share_token: "test_share_token_123"
    )
    shared_holiday.holiday_users.create!(user: @user, role: "owner")

    user_two = users(:two)
    user_two_headers = auth_headers_for(user_two)

    assert_difference("HolidayUser.count") do
      post join_holidays_path,
        headers: user_two_headers,
        params: { share_token: "test_share_token_123" },
        as: :json
    end
    assert_response :success
  end

  test "join with invalid token returns 404" do
    post join_holidays_path,
      headers: @auth_headers,
      params: { share_token: "invalid_token" },
      as: :json
    assert_response :not_found
  end

  # ============================================================================
  # Leave Tests
  # ============================================================================

  test "leave removes user from holiday" do
    # Create a completely new holiday for this test
    @workspace = workspaces(:one)
    new_holiday = Holiday.create!(name: "Leave Test Holiday", workspace: @workspace)
    new_holiday.holiday_users.create!(user: @user, role: "owner")

    user_two = users(:two)
    # Add user_two as workspace member so they can access the holiday
    @workspace.workspace_memberships.find_or_create_by!(user: user_two) do |m|
      m.role = "member"
    end
    # Add user_two as collaborator on the holiday
    new_holiday.holiday_users.create!(user: user_two, role: "collaborator")
    # Use auth_headers with workspace :one
    user_two_headers = auth_headers_for(user_two, workspace: @workspace)

    assert_difference("HolidayUser.count", -1) do
      delete leave_holiday_path(new_holiday), headers: user_two_headers, as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Collaborators Tests
  # ============================================================================

  test "collaborators returns holiday collaborators" do
    holiday = holidays(:christmas)
    get collaborators_holiday_path(holiday), headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
  end

  test "remove_collaborator removes a collaborator" do
    # Use birthday holiday and add a collaborator to remove
    holiday = holidays(:birthday)
    user_two = users(:two)

    # Add user_two as collaborator
    holiday.holiday_users.create!(user: user_two, role: "collaborator")

    assert_difference("HolidayUser.count", -1) do
      delete remove_collaborator_holiday_path(holiday, user_id: user_two.id),
        headers: @auth_headers,
        as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Authorization Tests
  # ============================================================================

  test "cannot access another user's private holiday" do
    other_user = users(:two)
    other_workspace = workspaces(:two)
    private_holiday = Holiday.create!(
      name: "Private Holiday",
      workspace: other_workspace
    )
    private_holiday.holiday_users.create!(user: other_user, role: "owner")

    get holiday_path(private_holiday), headers: @auth_headers, as: :json
    assert_response :not_found
  end
end
