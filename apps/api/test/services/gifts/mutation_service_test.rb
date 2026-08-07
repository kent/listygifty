require "test_helper"

class Gifts::MutationServiceTest < ActiveSupport::TestCase
  self.use_transactional_tests = false

  test "shared-holiday collaborators have independent creator quotas under concurrency" do
    first = create_user("first")
    second = create_user("second")
    workspace = Workspace.create!(name: "Shared quota", workspace_type: "business", created_by_user: first)
    workspace.workspace_memberships.create!(user: first, role: "owner")
    workspace.workspace_memberships.create!(user: second, role: "member")
    holiday = workspace.holidays.create!(name: "Shared quota holiday")
    holiday.holiday_users.create!(user: first, role: "owner")
    holiday.holiday_users.create!(user: second, role: "collaborator")
    status = GiftStatus.by_position.first!
    now = Time.current

    [ first, second ].each do |user|
      Gift.insert_all!(Array.new(User::FREE_GIFT_LIMIT - 1) do |index|
        {
          holiday_id: holiday.id,
          gift_status_id: status.id,
          created_by_user_id: user.id,
          name: "#{user.id} filler #{index}",
          position: index,
          created_at: now,
          updated_at: now
        }
      end)
    end

    ready = Queue.new
    start = Queue.new
    results = Queue.new
    threads = [ first.id, second.id ].map do |user_id|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          user = User.find(user_id)
          ready << true
          start.pop
          results << Gifts::MutationService.new(user).create(
            holiday_id: holiday.id,
            name: "Final quota gift"
          )
        rescue StandardError => e
          results << e
        end
      end
    end
    2.times { ready.pop }
    2.times { start << true }
    threads.each(&:join)

    outcomes = 2.times.map { results.pop }
    errors = outcomes.grep(Exception)
    assert outcomes.all? { |outcome| outcome.is_a?(Gift) }, errors.map(&:message).join(", ")
    assert_equal User::FREE_GIFT_LIMIT, first.gift_count
    assert_equal User::FREE_GIFT_LIMIT, second.gift_count
  ensure
    workspace&.destroy!
    first&.destroy!
    second&.destroy!
  end

  private

  def create_user(label)
    User.create!(
      email: "quota-#{label}-#{SecureRandom.hex(6)}@example.com",
      clerk_user_id: "quota_#{label}_#{SecureRandom.hex(8)}",
      subscription_plan: "free"
    )
  end
end
