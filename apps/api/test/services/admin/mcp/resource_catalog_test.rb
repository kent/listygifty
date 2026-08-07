require "test_helper"

class Admin::Mcp::ResourceCatalogTest < ActiveSupport::TestCase
  test "bounds and paginates bulk resource output by serialized bytes" do
    user = users(:one)
    70.times do |index|
      EmailDelivery.create!(
        user: user,
        kind: "digest",
        to_email: user.email,
        subject: "Delivery #{index}",
        sent_at: Time.current,
        status: "failed",
        dedupe_key: "catalog-bound-#{index}",
        error: "x" * 10_000
      )
    end

    result = Admin::Mcp::ResourceCatalog.new.list("email_deliveries", limit: 100)
    payload_bytes = JSON.generate(result).bytesize

    assert_operator payload_bytes, :<=, Admin::Mcp::ResourceCatalog::MAX_LIST_RESPONSE_BYTES
    assert_operator result[:count], :<, 70
    assert result[:next_after_id].present?
    assert_operator result[:records].first.fetch("error").bytesize, :<=,
      Admin::Mcp::ResourceCatalog::MAX_BULK_STRING_BYTES + "…".bytesize
  end
end
