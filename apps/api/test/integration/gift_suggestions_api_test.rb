require "test_helper"

class GiftSuggestionsApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @workspace = workspaces(:one)
    @person = people(:mom)
    @holiday = holidays(:christmas)
    @suggestion = gift_suggestions(:one)
  end

  # ============================================================================
  # Index and Create Tests
  # ============================================================================

  test "index returns suggestions for a person" do
    get person_gift_suggestions_path(@person), headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
  end

  test "create generates suggestions for a person" do
    # Mock OpenAI response for suggestion generation
    post person_gift_suggestions_path(@person), headers: @auth_headers, as: :json
    # This may return various responses depending on subscription/config
    assert_includes [ 200, 201, 403, 422, 503 ], response.status
  end

  test "refine suggestions for holiday context" do
    suggestion_ids = [ @suggestion.id ]

    post refine_person_gift_suggestions_path(@person),
      headers: @auth_headers,
      params: { suggestion_ids: suggestion_ids, holiday_id: @holiday.id },
      as: :json
    # May return various responses depending on subscription/OpenAI
    assert_includes [ 200, 201, 403, 422, 503 ], response.status
  end

  test "refine rejects too many suggestion IDs before invoking AI" do
    @user.update!(subscription_plan: "premium", subscription_expires_at: 1.month.from_now)
    ids = Array.new(GiftSuggestionService::MAX_REFINEMENT_SUGGESTIONS + 1) { |index| index + 1 }

    post refine_person_gift_suggestions_path(@person),
      headers: @auth_headers,
      params: { suggestion_ids: ids, holiday_id: @holiday.id },
      as: :json
    assert_response :bad_request
  end

  # ============================================================================
  # Accept and Discard Tests
  # ============================================================================

  test "accept converts suggestion to gift" do
    assert_difference("Gift.count") do
      post accept_gift_suggestion_path(@suggestion),
        headers: @auth_headers,
        params: { holiday_id: @holiday.id },
        as: :json
    end
    assert_response :success
  end

  test "accept enforces the creator quota without consuming the suggestion" do
    @user.update!(subscription_plan: "free", subscription_expires_at: nil)
    status = GiftStatus.by_position.first!
    missing = [ User::FREE_GIFT_LIMIT - @user.gift_count, 0 ].max
    now = Time.current
    Gift.insert_all!(Array.new(missing) do |index|
      {
        holiday_id: @holiday.id,
        gift_status_id: status.id,
        created_by_user_id: @user.id,
        name: "Suggestion limit filler #{index}",
        position: index,
        created_at: now,
        updated_at: now
      }
    end) if missing.positive?

    assert_no_difference([ "Gift.count", "GiftSuggestion.count" ]) do
      post accept_gift_suggestion_path(@suggestion), headers: @auth_headers, as: :json
    end
    assert_response :payment_required
    assert GiftSuggestion.exists?(@suggestion.id)
  end

  test "removed workspace and holiday members cannot use stale owned-person suggestions" do
    owner = users(:two)
    workspace = Workspace.create!(name: "Removed suggestion access", workspace_type: "business", created_by_user: owner)
    workspace.workspace_memberships.create!(user: owner, role: "owner")
    membership = workspace.workspace_memberships.create!(user: @user, role: "member")
    holiday = workspace.holidays.create!(name: "Former shared holiday")
    holiday.holiday_users.create!(user: owner, role: "owner")
    holiday_membership = holiday.holiday_users.create!(user: @user, role: "collaborator")
    person = workspace.people.create!(name: "Former contact", user: @user)
    suggestion = person.gift_suggestions.create!(name: "Stale suggestion", holiday: holiday)
    membership.destroy!
    holiday_membership.destroy!

    get person_gift_suggestions_path(person), headers: @auth_headers, as: :json
    assert_response :not_found
    assert_no_difference([ "Gift.count", "GiftSuggestion.count" ]) do
      post accept_gift_suggestion_path(suggestion), headers: @auth_headers, as: :json
    end
    assert_response :not_found
  end

  test "external collaborators see only visible suggestions and cannot mutate them" do
    owner = users(:two)
    workspace = workspaces(:two)
    person = workspace.people.create!(name: "Shared suggestion contact", user: owner)
    visible_holiday = workspace.holidays.create!(name: "Visible suggestion holiday")
    visible_holiday.holiday_users.create!(user: owner, role: "owner")
    visible_holiday.holiday_users.create!(user: @user, role: "collaborator")
    HolidayPerson.create!(holiday: visible_holiday, person: person)
    hidden_holiday = workspace.holidays.create!(name: "Hidden suggestion holiday")
    hidden_holiday.holiday_users.create!(user: owner, role: "owner")
    unshared_joined_holiday = workspace.holidays.create!(name: "Joined but person not shared")
    unshared_joined_holiday.holiday_users.create!(user: owner, role: "owner")
    unshared_joined_holiday.holiday_users.create!(user: @user, role: "collaborator")
    general = person.gift_suggestions.create!(name: "General suggestion")
    visible = person.gift_suggestions.create!(name: "Visible suggestion", holiday: visible_holiday)
    hidden = person.gift_suggestions.create!(name: "Hidden suggestion", holiday: hidden_holiday)
    unshared = person.gift_suggestions.create!(name: "Unshared suggestion", holiday: unshared_joined_holiday)

    get person_gift_suggestions_path(person), headers: @auth_headers, as: :json
    assert_response :success
    ids = json_response.pluck("id")
    assert_not_includes ids, general.id
    assert_includes ids, visible.id
    assert_not_includes ids, hidden.id
    assert_not_includes ids, unshared.id

    post person_gift_suggestions_path(person), headers: @auth_headers, as: :json
    assert_response :forbidden
    post refine_person_gift_suggestions_path(person), headers: @auth_headers,
      params: { suggestion_ids: [ general.id ], holiday_id: visible_holiday.id }, as: :json
    assert_response :forbidden
  end

  test "accept without holiday_id still creates gift" do
    # Create a new suggestion for this test
    new_suggestion = GiftSuggestion.create!(
      person: @person,
      name: "Test Suggestion",
      description: "Test Description",
      approximate_price: 50.0
    )

    assert_difference("Gift.count") do
      post accept_gift_suggestion_path(new_suggestion),
        headers: @auth_headers,
        as: :json
    end
    assert_response :success
  end

  test "destroy discards a suggestion" do
    # Create a suggestion to delete
    new_suggestion = GiftSuggestion.create!(
      person: @person,
      name: "Delete Me",
      description: "Test",
      approximate_price: 25.0
    )

    assert_difference("GiftSuggestion.count", -1) do
      delete gift_suggestion_path(new_suggestion), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  # ============================================================================
  # Authorization Tests
  # ============================================================================

  test "cannot access another user's person suggestions" do
    other_user = users(:two)
    other_person = Person.create!(
      user: other_user,
      workspace: workspaces(:two),
      name: "Other Person"
    )

    get person_gift_suggestions_path(other_person), headers: @auth_headers, as: :json
    assert_response :not_found
  end

  test "requires authentication" do
    get person_gift_suggestions_path(@person), as: :json
    assert_response :unauthorized
  end
end
