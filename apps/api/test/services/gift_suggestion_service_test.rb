require "test_helper"

class GiftSuggestionServiceTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @owner = users(:two)
    @workspace = workspaces(:two)
    @person = @workspace.people.create!(name: "Suggestion scope person", user: @owner)
    @visible_holiday = @workspace.holidays.create!(name: "Visible prompt holiday")
    @visible_holiday.holiday_users.create!(user: @owner, role: "owner")
    @visible_holiday.holiday_users.create!(user: @user, role: "collaborator")
    HolidayPerson.create!(holiday: @visible_holiday, person: @person)
    @hidden_holiday = @workspace.holidays.create!(name: "Hidden prompt holiday")
    @hidden_holiday.holiday_users.create!(user: @owner, role: "owner")
    status = GiftStatus.by_position.first!
    visible_gift = @visible_holiday.gifts.create!(name: "Visible prior gift", gift_status: status, created_by: @owner)
    hidden_gift = @hidden_holiday.gifts.create!(name: "Hidden prior gift", gift_status: status, created_by: @owner)
    visible_gift.recipients << @person
    hidden_gift.recipients << @person
  end

  test "generation prompt excludes gifts from holidays the caller cannot access" do
    captured_prompt = nil
    service = GiftSuggestionService.new(@person, @user)
    service.define_singleton_method(:call_openai) do |prompt|
      captured_prompt = prompt
      Array.new(GiftSuggestionService::SUGGESTION_COUNT) do |index|
        { "name" => "Suggestion #{index}", "description" => "Description", "approximate_price" => "$25" }
      end
    end
    assert_difference("GiftSuggestion.count", GiftSuggestionService::SUGGESTION_COUNT) do
      service.generate
    end

    assert_includes captured_prompt, "Visible prior gift"
    assert_not_includes captured_prompt, "Hidden prior gift"
  end

  test "refinement rejects suggestions tied to a hidden holiday" do
    @workspace.workspace_memberships.create!(user: @user, role: "member")
    hidden = @person.gift_suggestions.create!(name: "Hidden source", holiday: @hidden_holiday)
    service = GiftSuggestionService.new(@person, @user)

    assert_raises(ActiveRecord::RecordNotFound) do
      service.refine_for_holiday([ hidden.id ], @visible_holiday)
    end
    assert GiftSuggestion.exists?(hidden.id)
  end
  test "refinement bounds input count before querying or calling OpenAI" do
    service = GiftSuggestionService.new(@person, @user)
    too_many = Array.new(GiftSuggestionService::MAX_REFINEMENT_SUGGESTIONS + 1, 123)

    error = assert_raises(ArgumentError) do
      service.refine_for_holiday(too_many, @visible_holiday)
    end
    assert_match(/Select between/, error.message)
  end

  test "generation rejects malformed or oversized model output" do
    service = GiftSuggestionService.new(@person, @user)
    service.define_singleton_method(:call_openai) do |_prompt|
      [ { "name" => "x" * 501, "description" => "Description", "approximate_price" => "$25" } ]
    end

    assert_no_difference("GiftSuggestion.count") do
      assert_raises(ArgumentError) { service.generate }
    end
  end
end
