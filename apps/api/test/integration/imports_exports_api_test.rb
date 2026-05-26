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
    john = @workspace.people.find_by!(email: "john@example.com")
    assert_equal Date.new(1990, 1, 15), john.birthday
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
    person = business_workspace.people.find_by!(email: "jamie@example.com")
    assert_equal "123 Maple Street", address.street_line_1
    assert_equal address, person.default_shipping_address
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

  test "imports gifts creates gifts and recipients from CSV" do
    csv_content = "name,description,cost,status,link,recipient_name,recipient_email\nTeam Hoodie,Blue hoodie,49.99,Idea,https://example.com,Jamie Lee,jamie@example.com"
    file = Rack::Test::UploadedFile.new(
      StringIO.new(csv_content),
      "text/csv",
      original_filename: "gifts.csv"
    )

    assert_difference([ "Gift.count", "Person.count" ], 1) do
      post "/imports/gifts",
        headers: @auth_headers.except("Content-Type"),
        params: { file: file, holiday_id: @holiday.id }
    end

    assert_response :success
    assert_equal 1, json_response["created"]
    assert_equal 1, json_response["people_created"]

    gift = Gift.find_by!(name: "Team Hoodie")
    assert_equal @holiday, gift.holiday
    assert_equal "49.99", gift.cost.to_s
    assert_equal "jamie@example.com", gift.recipients.first.email
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

  test "exports people includes default shipping address columns" do
    business_workspace = Workspace.create!(
      name: "Acme Gifts",
      workspace_type: "business",
      created_by_user: @user
    )
    business_workspace.workspace_memberships.create!(user: @user, role: "owner")
    company_profile = business_workspace.create_company_profile!(name: "Acme Gifts")
    address = company_profile.addresses.create!(
      label: "Jamie Home",
      street_line_1: "123 Maple Street",
      street_line_2: "Unit 4",
      city: "Toronto",
      state: "ON",
      postal_code: "M5V 2T6",
      country: "CA",
      is_default: true
    )
    business_workspace.people.create!(
      name: "Jamie Lee",
      email: "jamie@example.com",
      relationship: "co-worker",
      birthday: Date.new(1991, 3, 14),
      user: @user,
      default_shipping_address: address
    )

    get "/exports/people", headers: auth_headers_for(@user, workspace: business_workspace)

    assert_response :success
    csv = CSV.parse(response.body, headers: true)
    jamie = csv.find { |row| row["Email"] == "jamie@example.com" }
    assert_equal "Jamie Home", jamie["Address Label"]
    assert_equal "1991-03-14", jamie["Birthday"]
    assert_equal "123 Maple Street", jamie["Street Line 1"]
    assert_equal "Unit 4", jamie["Street Line 2"]
    assert_equal "Toronto", jamie["City"]
    assert_equal "ON", jamie["State"]
    assert_equal "M5V 2T6", jamie["Postal Code"]
    assert_equal "CA", jamie["Country"]
    assert_equal "true", jamie["Default Company Address"]
  end

  test "exports require authentication" do
    get "/exports/people"
    assert_response :unauthorized
  end
end
