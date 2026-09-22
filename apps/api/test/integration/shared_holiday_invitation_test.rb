require "test_helper"

class SharedHolidayInvitationTest < ActionDispatch::IntegrationTest
  setup do
    @owner = users(:one)
    @guest = users(:two)
    @headers = auth_headers_for(@guest)
    @holiday = workspaces(:one).holidays.create!(name: "Invited Gift List")
    @holiday.holiday_users.create!(user: @owner, role: "owner")
    @holiday.shared_people << people(:mom)
    @gift = @holiday.gifts.create!(name: "Shared gift", gift_status: gift_statuses(:idea), created_by: @owner)
  end

  test "accepting an invitation makes the list usable from the guest's personal workspace" do
    assert_difference("HolidayUser.count", 1) { accept_invitation }
    assert_response :created
    assert_equal @holiday.id, json_response["id"]
    assert_not workspaces(:one).member?(@guest)

    get holidays_path, headers: @headers, as: :json
    assert_response :success
    assert_includes json_response.pluck("id"), @holiday.id
    assert_not_includes json_response.pluck("id"), holidays(:birthday).id

    get holiday_path(@holiday), headers: @headers, as: :json
    assert_response :success
    assert_equal "collaborator", json_response["role"]
    assert_nil json_response["share_token"]

    get "/bootstrap", headers: @headers, as: :json
    assert_response :success
    payload = json_response
    assert_equal @guest.personal_workspace.id, payload["current_workspace_id"]
    assert_not_includes payload.fetch("workspaces").pluck("id"), workspaces(:one).id
    assert_includes payload.dig("data", "holidays").pluck("id"), @holiday.id
    assert_includes payload.dig("data", "pending_gifts").pluck("id"), @gift.id
    assert_includes payload.dig("data", "people").pluck("id"), people(:mom).id
    assert_not_includes payload.dig("data", "holidays").pluck("id"), holidays(:birthday).id

    get people_path(holiday_id: @holiday.id), headers: @headers, as: :json
    assert_response :success
    assert_includes json_response.pluck("id"), people(:mom).id
    assert_not_includes json_response.pluck("id"), people(:dad).id

    get people_path, headers: @headers, as: :json
    assert_response :success
    assert_includes json_response.pluck("id"), people(:mom).id

    get gifts_path(holiday_id: @holiday.id), headers: @headers, as: :json
    assert_response :success
    assert_equal [ @gift.id ], json_response.pluck("id")

    patch gift_path(@gift), headers: @headers, params: { gift: { name: "Updated shared gift" } }, as: :json
    assert_response :success
    assert_equal "Updated shared gift", @gift.reload.name

    get "/exports/gifts", headers: @headers, params: { holiday_id: @holiday.id }
    assert_response :success
    assert_includes response.body, "Updated shared gift"
  end

  test "collaborators can add their own recipients without accessing the owner's private contacts" do
    accept_invitation
    post gifts_path, headers: @headers, params: {
      gift: { name: "Guest's gift", holiday_id: @holiday.id, recipient_ids: [ people(:sister).id ] }
    }, as: :json
    assert_response :created
    assert_equal [ people(:sister).id ], json_response.fetch("recipients").pluck("id")
    assert_includes @holiday.shared_people, people(:sister)

    assert_no_difference("Gift.count") do
      post gifts_path, headers: @headers, params: {
        gift: { name: "Private recipient", holiday_id: @holiday.id, recipient_ids: [ people(:dad).id ] }
      }, as: :json
    end
    assert_response :not_found
  end

  test "collaborators can import gifts into the shared list from their own workspace" do
    accept_invitation
    file = Rack::Test::UploadedFile.new(
      StringIO.new("name,recipient_name\nNew shared gift,Guest contact\n"),
      "text/csv",
      original_filename: "gifts.csv"
    )
    post "/imports/gifts", headers: @headers.except("Content-Type"),
      params: { holiday_id: @holiday.id, file: file }
    assert_response :success
    assert_equal 1, json_response["created"]
    gift = @holiday.gifts.find_by!(name: "New shared gift")
    assert_equal @guest.id, gift.created_by_user_id
    assert_equal @guest.personal_workspace.id, gift.recipients.first!.workspace_id
  end

  test "reopening an invitation succeeds without duplicate membership or welcome emails" do
    @guest.update!(welcomed_at: nil)
    assert_enqueued_emails(1) { accept_invitation }
    assert_response :created

    assert_no_difference("HolidayUser.count") do
      assert_no_enqueued_emails { accept_invitation }
    end
    assert_response :ok
    assert_equal @holiday.id, json_response["id"]
    assert_equal "collaborator", json_response["role"]
  end

  test "leaving a shared list removes access without needing workspace membership" do
    accept_invitation
    delete leave_holiday_path(@holiday), headers: @headers, as: :json
    assert_response :no_content

    get holiday_path(@holiday), headers: @headers, as: :json
    assert_response :not_found
    get people_path(holiday_id: @holiday.id), headers: @headers, as: :json
    assert_response :not_found
    get holidays_path, headers: @headers, as: :json
    assert_not_includes json_response.pluck("id"), @holiday.id
  end

  test "shared personal lists stay out of business workspaces and business lists stay scoped" do
    accept_invitation
    business = Workspace.create!(name: "Guest's business", workspace_type: "business", created_by_user: @guest)
    business.workspace_memberships.create!(user: @guest, role: "owner")
    business_holiday = business.holidays.create!(name: "Business list")
    business_holiday.holiday_users.create!(user: @guest, role: "owner")

    get holidays_path, headers: auth_headers_for(@guest, workspace: business), as: :json
    assert_response :success
    assert_equal [ business_holiday.id ], json_response.pluck("id")

    get holidays_path, headers: @headers, as: :json
    assert_response :success
    assert_includes json_response.pluck("id"), @holiday.id
    assert_not_includes json_response.pluck("id"), business_holiday.id
  end

  private

  def accept_invitation
    post join_holidays_path, headers: @headers, params: { share_token: @holiday.share_token }, as: :json
  end
end
