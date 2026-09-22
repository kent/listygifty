require "test_helper"
require_relative "../support/database_lock_assertions"

class AddressDefaultConcurrencyTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  include DatabaseLockAssertions

  test "concurrent default changes are serialized on the company profile" do
    skip "Row-lock regression requires PostgreSQL" unless ActiveRecord::Base.connection.adapter_name == "PostgreSQL"
    workspace = Workspace.create!(name: "Address defaults", workspace_type: "business", created_by_user: users(:one))
    profile = workspace.create_company_profile!(name: "Company")
    first, second = 2.times.map do |index|
      profile.addresses.create!(label: "Address #{index}", street_line_1: "1 Main St", city: "Toronto", postal_code: "M5V 1A1", country: "CA")
    end

    assert_waiting_mutation(profile, -> { Address.find(second.id).update!(is_default: true) }) do
      first.update!(is_default: true)
    end

    assert_equal [ second.id ], profile.addresses.where(is_default: true).pluck(:id)
  ensure
    workspace&.destroy!
  end
end
