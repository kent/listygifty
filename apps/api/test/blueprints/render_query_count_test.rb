require "test_helper"

# Guards against N+1 queries while serializing. Blueprinter hands field blocks a
# copy of the options, so per-render memoization has to go through
# ApplicationBlueprint.render_cached, and nested people need Person::RENDER_INCLUDES.
#
# Tests run inside the executor with the query cache on, and cached queries
# aren't counted, so each assertion disables it to see every repeat.
class RenderQueryCountTest < ActiveSupport::TestCase
  test "person gift counts are computed once per render, not once per person" do
    user = users(:one)
    people = Person.where(id: [ people(:mom).id, people(:dad).id ]).includes(*Person::RENDER_INCLUDES).to_a

    rendered = nil
    assert_queries_match(/FROM "gift_recipients"/, count: 1) do
      assert_queries_match(/FROM "gift_givers"/, count: 1) do
        rendered = uncached { PersonBlueprint.render_as_hash(people, current_user: user, current_workspace: workspaces(:one)) }
      end
    end

    expected = people.to_h do |person|
      visible = Gift.where(holiday_id: user.holiday_ids)
      count = visible.joins(:gift_recipients).where(gift_recipients: { person_id: person.id }).count +
        visible.joins(:gift_givers).where(gift_givers: { person_id: person.id }).count
      [ person.id, count ]
    end
    assert_equal expected, rendered.to_h { |person| [ person[:id], person[:gift_count] ] }
  end

  test "rendering preloaded gifts does not query per recipient or giver" do
    user = users(:one)
    gifts = Gift.where(holiday_id: user.holiday_ids).includes(*Gift::RENDER_INCLUDES).to_a
    assert gifts.sum { |gift| gift.gift_recipients.size } >= 2, "fixtures should give gifts several recipients"

    assert_queries_match(/FROM "addresses"|FROM "holidays"|FROM "people"/, count: 0) do
      assert_queries_match(/FROM "workspace_memberships"/, count: 1) do
        uncached { GiftBlueprint.render_as_hash(gifts, current_user: user) }
      end
    end
  end

  test "the render cache does not outlive a single render" do
    user = users(:one)
    people = Person.where(id: people(:mom).id).to_a

    assert_queries_match(/FROM "gift_recipients"/, count: 2) do
      uncached do
        PersonBlueprint.render_as_hash(people, current_user: user, current_workspace: workspaces(:one))
        PersonBlueprint.render_as_hash(people, current_user: user, current_workspace: workspaces(:one))
      end
    end
  end

  private

  def uncached(&) = ActiveRecord::Base.uncached(&)
end
