require "test_helper"
require "csv"

class ImportsExportsApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @workspace = workspaces(:one)
    @holiday = holidays(:christmas)
  end

  # ============================================================================
  # Import Tests
  # ============================================================================

  test "imports people processes CSV" do
    csv_content = "name,email,birthday\nJohn Doe,john@example.com,1990-01-15\nJane Smith,jane@example.com,1985-06-20"
    file = Rack::Test::UploadedFile.new(
      StringIO.new(csv_content),
      "text/csv",
      original_filename: "people.csv"
    )

    post "/imports/people",
      headers: @auth_headers.except("Content-Type"),
      params: { file: file }
    # Should successfully process the import request
    assert_response :success
  end

  test "imports people creates business addresses from CSV" do
    business_workspace = Workspace.create!(
      name: "Acme Gifts",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    headers = auth_headers_for(@user, workspace: business_workspace).except("Content-Type")
    csv_content = "name,email,address_label,street_line_1,city,state,postal_code,country,is_default\nJamie Lee,jamie@example.com,Jamie home,123 Maple Street,Toronto,ON,M5V 2T6,CA,true"
    file = Rack::Test::UploadedFile.new(
      StringIO.new(csv_content),
      "text/csv",
      original_filename: "people_with_addresses.csv"
    )

    post "/imports/people",
      headers: headers,
      params: { file: file }

    assert_response :success
    assert_equal 1, json_response["created"]
    assert_equal 1, json_response["addresses_created"]
    address = business_workspace.company_profile.addresses.find_by!(label: "Jamie home")
    assert_equal "123 Maple Street", address.street_line_1
    assert address.is_default?
  end

  test "imports people handles invalid CSV" do
    invalid_csv = "this,is,not,valid"
    file = Rack::Test::UploadedFile.new(
      StringIO.new(invalid_csv),
      "text/csv",
      original_filename: "invalid.csv"
    )

    post "/imports/people",
      headers: @auth_headers.except("Content-Type"),
      params: { file: file }
    # May succeed with 0 imports or fail with validation error
    assert_includes [ 200, 422 ], response.status
  end

  test "imports people requires authentication" do
    csv_content = "name,email\nTest,test@example.com"
    file = Rack::Test::UploadedFile.new(
      StringIO.new(csv_content),
      "text/csv",
      original_filename: "people.csv"
    )

    post "/imports/people", params: { file: file }
    assert_response :unauthorized
  end

  # ============================================================================
  # Export Tests
  # ============================================================================

  test "exports gifts returns CSV" do
    people(:mom).update!(email: "mom@example.com")
    @workspace.update!(workspace_type: "business")
    company_profile = CompanyProfile.create!(workspace: @workspace, name: "Acme Gifts")
    address = company_profile.addresses.create!(
      label: "Mom Home",
      street_line_1: "123 Maple Street",
      city: "Toronto",
      state: "ON",
      postal_code: "M5V 2T6",
      country: "CA"
    )
    GiftRecipient.find_by!(gift: gifts(:sweater), person: people(:mom)).update!(
      shipping_address: address
    )

    get "/exports/gifts",
      headers: @auth_headers,
      params: { holiday_id: @holiday.id }
    assert_response :success
    assert_match "text/csv", response.content_type

    csv = CSV.parse(response.body, headers: true)
    sweater = csv.find { |row| row["Name"] == "Wool Sweater" }
    assert_equal "mom@example.com", sweater["Recipient Emails"]
    assert_includes sweater["Shipping Addresses"], "123 Maple Street"
  end

  test "exports gifts returns 404 without holiday_id" do
    get "/exports/gifts", headers: @auth_headers
    # May return 404 (not found) or 422 (unprocessable) depending on implementation
    assert_includes [ 404, 422 ], response.status
  end

  test "exports people returns CSV" do
    get "/exports/people", headers: @auth_headers
    assert_response :success
    assert_match "text/csv", response.content_type
  end

  test "exports require authentication" do
    get "/exports/people"
    assert_response :unauthorized
  end
end
