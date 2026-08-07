require "test_helper"

class PeopleApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
  end

  test "index returns people for current user" do
    get people_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_equal 2, json_response.length # mom and dad
  end

  test "show returns a person" do
    person = people(:mom)
    get person_path(person), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal person.name, json_response["name"]
  end

  test "create creates a person" do
    assert_difference("Person.count") do
      post people_path,
        headers: @auth_headers,
        params: { person: { name: "New Person" } },
        as: :json
    end
    assert_response :created
    assert_equal @user.id, Person.last.user_id
  end

  test "update modifies a person" do
    person = people(:mom)
    patch person_path(person),
      headers: @auth_headers,
      params: { person: { name: "Updated Name" } },
      as: :json
    assert_response :success
    assert_equal "Updated Name", person.reload.name
  end

  test "ordinary workspace members can edit contact fields but only admins can assign addresses" do
    owner = users(:one)
    member = users(:two)
    workspace = Workspace.create!(
      name: "Address policy workspace",
      workspace_type: "business",
      created_by_user: owner
    )
    workspace.workspace_memberships.create!(user: owner, role: "owner")
    workspace.workspace_memberships.create!(user: member, role: "member")
    profile = workspace.create_company_profile!(name: "Address Policy Co")
    address = profile.addresses.create!(
      label: "Admin-only address",
      street_line_1: "10 Admin Way",
      city: "Toronto",
      postal_code: "M5V 4D4",
      country: "CA"
    )
    person = workspace.people.create!(name: "Workspace contact", user: owner)
    member_headers = auth_headers_for(member, workspace: workspace)

    patch person_path(person), headers: member_headers,
      params: { person: { name: "Member-edited contact" } }, as: :json
    assert_response :success
    assert_equal "Member-edited contact", person.reload.name

    patch person_path(person), headers: member_headers,
      params: { person: { default_shipping_address_id: address.id } }, as: :json
    assert_response :forbidden
    assert_nil person.reload.default_shipping_address_id

    patch person_path(person), headers: auth_headers_for(owner, workspace: workspace),
      params: { person: { default_shipping_address_id: address.id } }, as: :json
    assert_response :success
    assert_equal address.id, person.reload.default_shipping_address_id
  end

  test "destroy removes a person" do
    # Create a person without gifts attached
    workspace = workspaces(:one)
    person = @user.people.create!(name: "Test Person", workspace: workspace)
    assert_difference("Person.count", -1) do
      delete person_path(person), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  test "cannot access another user's people" do
    other_person = people(:sister) # belongs to user two
    get person_path(other_person), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  # ============================================================================
  # Shared People Tests
  # ============================================================================

  test "collaborator can view shared person" do
    # User two is a collaborator on christmas, which has mom shared to it
    user_two = users(:two)
    user_two_headers = auth_headers_for(user_two)
    mom = people(:mom)

    get person_path(mom), headers: user_two_headers, as: :json
    assert_response :success
    assert_equal mom.name, json_response["name"]
    assert_equal false, json_response["is_mine"]
  end

  test "external collaborator cannot edit a shared person's PII" do
    user_two = users(:two)
    user_two_headers = auth_headers_for(user_two)
    mom = people(:mom)

    patch person_path(mom),
      headers: user_two_headers,
      params: { person: { name: "Mama", default_shipping_address_id: 123_456 } },
      as: :json
    assert_response :forbidden
    assert_equal "Mom", mom.reload.name
  end

  test "collaborator cannot delete shared person" do
    user_two = users(:two)
    user_two_headers = auth_headers_for(user_two)
    mom = people(:mom)

    delete person_path(mom), headers: user_two_headers, as: :json
    assert_response :forbidden
  end

  test "index returns shared people for collaborator" do
    user_two = users(:two)
    # User two is a collaborator on christmas holiday in workspace_one
    # They need to access workspace_one to see shared people from that holiday
    workspace_one = workspaces(:one)
    # Add user_two as a member of workspace_one for this test
    workspace_one.workspace_memberships.create!(user: user_two, role: "member")
    user_two_headers = auth_headers_for(user_two, workspace: workspace_one)

    get people_path, headers: user_two_headers, as: :json
    assert_response :success

    names = json_response.map { |p| p["name"] }
    # User two should see shared "mom" and "dad" from christmas (via holiday collaboration)
    assert_includes names, "Mom"
    assert_includes names, "Dad"
  end

  test "person gift details and counts include only holidays the caller joined" do
    owner = users(:two)
    workspace = workspaces(:two)
    person = workspace.people.create!(name: "Gift-scoped contact", user: owner)
    visible_holiday = workspace.holidays.create!(name: "Visible person gifts")
    visible_holiday.holiday_users.create!(user: owner, role: "owner")
    visible_holiday.holiday_users.create!(user: @user, role: "collaborator")
    HolidayPerson.create!(holiday: visible_holiday, person: person)
    hidden_holiday = workspace.holidays.create!(name: "Hidden person gifts")
    hidden_holiday.holiday_users.create!(user: owner, role: "owner")
    status = GiftStatus.by_position.first!
    visible_gift = visible_holiday.gifts.create!(name: "Visible child gift", gift_status: status, created_by: owner)
    hidden_gift = hidden_holiday.gifts.create!(name: "Hidden child gift", gift_status: status, created_by: owner)
    visible_gift.recipients << person
    hidden_gift.recipients << person

    get person_path(person, include: "gifts"), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal [ visible_gift.id ], json_response.fetch("gifts_received").pluck("id")
    assert_equal 1, json_response["gift_count"]

    workspace.workspace_memberships.create!(user: @user, role: "member")
    get person_path(person, include: "gifts"),
      headers: auth_headers_for(@user, workspace: workspace), as: :json
    assert_response :success
    assert_equal [ visible_gift.id ], json_response.fetch("gifts_received").pluck("id")
    assert_equal 1, json_response["gift_count"]
  end

  test "user cannot access person from non-shared holiday" do
    # Create a private holiday for user two with a person
    user_two = users(:two)
    workspace_two = workspaces(:two)
    private_holiday = Holiday.create!(name: "Private Party", workspace: workspace_two)
    private_holiday.holiday_users.create!(user: user_two, role: "owner")
    private_person = user_two.people.create!(name: "Secret Friend", workspace: workspace_two)
    HolidayPerson.create!(holiday: private_holiday, person: private_person)

    # User one should NOT be able to access this person
    get person_path(private_person), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  test "retroactive sharing - new collaborator sees existing people" do
    # Create scenario: user one has a holiday with gifts and people
    # Then invites user two - user two should see the people
    user_one = users(:one)
    user_two = users(:two)
    workspace_one = workspaces(:one)

    new_holiday = Holiday.create!(name: "New Year 2026", workspace: workspace_one)
    new_holiday.holiday_users.create!(user: user_one, role: "owner")
    new_person = user_one.people.create!(name: "Colleague", workspace: workspace_one)
    HolidayPerson.create!(holiday: new_holiday, person: new_person)

    # Before invitation, user two cannot see the person
    user_two_headers = auth_headers_for(user_two)
    get person_path(new_person), headers: user_two_headers, as: :json
    assert_response :not_found

    # After invitation, user two can see but cannot edit the owner's person
    new_holiday.holiday_users.create!(user: user_two, role: "collaborator")

    get person_path(new_person), headers: user_two_headers, as: :json
    assert_response :success
    assert_equal "Colleague", json_response["name"]

    patch person_path(new_person),
      headers: user_two_headers,
      params: { person: { name: "Work Buddy" } },
      as: :json
    assert_response :forbidden
    assert_equal "Colleague", new_person.reload.name
  end

  test "index with holiday_id hides same-workspace holidays the caller has not joined" do
    hidden = workspaces(:one).holidays.create!(name: "Hidden people holiday")
    hidden.holiday_users.create!(user: users(:two), role: "owner")
    external_person = workspaces(:two).people.create!(name: "Hidden shared contact", user: users(:two))
    HolidayPerson.create!(holiday: hidden, person: external_person)

    get people_path(holiday_id: hidden.id), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  test "index with holiday_id returns people for that holiday" do
    christmas = holidays(:christmas)
    get people_path(holiday_id: christmas.id), headers: @auth_headers, as: :json
    assert_response :success

    names = json_response.map { |p| p["name"] }
    assert_includes names, "Mom"
    assert_includes names, "Dad"
  end
end
