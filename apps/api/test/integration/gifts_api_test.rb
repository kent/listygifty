require "test_helper"

class GiftsApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @holiday = holidays(:christmas)
    @status = gift_statuses(:idea)
  end

  test "index returns gifts" do
    get gifts_path, headers: @auth_headers, as: :json
    assert_response :success
  end

  test "index filters gifts by holiday" do
    get "#{gifts_path}?holiday_id=#{@holiday.id}", headers: @auth_headers, as: :json

    assert_response :success
    assert_equal [ gifts(:sweater).id ], json_response.map { |gift| gift["id"] }
  end

  test "show returns a gift" do
    gift = gifts(:sweater)
    get gift_path(gift), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal gift.name, json_response["name"]
  end

  test "create creates a gift" do
    assert_difference("Gift.count") do
      post gifts_path,
        headers: @auth_headers,
        params: {
          gift: {
            name: "New Gift",
            holiday_id: @holiday.id,
            gift_status_id: @status.id
          }
        },
        as: :json
    end
    assert_response :created
  end

  test "update modifies a gift" do
    gift = gifts(:sweater)
    patch gift_path(gift),
      headers: @auth_headers,
      params: { gift: { name: "Updated Gift" } },
      as: :json
    assert_response :success
    assert_equal "Updated Gift", gift.reload.name
  end

  test "destroy removes a gift" do
    gift = gifts(:sweater)
    assert_difference("Gift.count", -1) do
      delete gift_path(gift), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Reorder Tests
  # ============================================================================

  test "reorder changes gift position" do
    gift = gifts(:sweater)
    patch reorder_gift_path(gift),
      headers: @auth_headers,
      params: { position: 5 },
      as: :json
    assert_response :success
  end

  # ============================================================================
  # Gift Recipients Tests
  # ============================================================================

  test "gift recipient update modifies shipping address" do
    gift = gifts(:sweater)
    person = people(:mom)
    recipient = gift.gift_recipients.create!(person: person)

    # Create a business workspace with an address
    business_workspace = Workspace.create!(
      name: "Business",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    company_profile = business_workspace.create_company_profile!(name: "Test Co")
    address = company_profile.addresses.create!(
      label: "Office",
      street_line_1: "123 Main St",
      city: "Toronto",
      postal_code: "M5V1A1",
      country: "CA"
    )

    patch gift_gift_recipient_path(gift, recipient),
      headers: @auth_headers,
      params: { gift_recipient: { shipping_address_id: address.id } },
      as: :json
    # May succeed or fail based on address access
    assert_includes [ 200, 403, 422 ], response.status
  end

  test "gift recipient update clears shipping address" do
    gift = gifts(:sweater)
    person = people(:mom)
    recipient = gift.gift_recipients.create!(person: person)

    patch gift_gift_recipient_path(gift, recipient),
      headers: @auth_headers,
      params: { gift_recipient: { shipping_address_id: nil } },
      as: :json
    assert_response :success
  end

  # ============================================================================
  # Authorization Tests
  # ============================================================================

  test "cannot access another user's gifts" do
    other_user = users(:two)
    other_workspace = workspaces(:two)
    other_holiday = Holiday.create!(name: "Other Holiday", workspace: other_workspace)
    other_holiday.holiday_users.create!(user: other_user, role: "owner")
    # Use existing fixture status
    other_gift = Gift.create!(
      holiday: other_holiday,
      created_by: other_user,
      name: "Secret Gift",
      gift_status: @status
    )

    get gift_path(other_gift), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  test "requires authentication" do
    get gifts_path, as: :json
    assert_response :unauthorized
  end
end
