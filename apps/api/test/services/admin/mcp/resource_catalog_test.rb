require "test_helper"

class Admin::Mcp::ResourceCatalogTest < ActiveSupport::TestCase
  test "bounds and paginates bulk resource output by serialized bytes" do
    user = users(:one)
    after_id = EmailDelivery.maximum(:id)
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

    result = Admin::Mcp::ResourceCatalog.new.list("email_deliveries", limit: 100, after_id: after_id)
    payload_bytes = JSON.generate(result).bytesize

    assert_operator payload_bytes, :<=, Admin::Mcp::ResourceCatalog::MAX_LIST_RESPONSE_BYTES
    assert_operator result[:count], :<, 70
    assert result[:next_after_id].present?
    assert_operator result[:records].first.fetch("error").bytesize, :<=,
      Admin::Mcp::ResourceCatalog::MAX_BULK_STRING_BYTES + "…".bytesize
  end

  test "the byte budget includes the JSON envelope and record separators" do
    catalog = Admin::Mcp::ResourceCatalog.new
    after_id = EmailDelivery.maximum(:id)
    2.times do |index|
      EmailDelivery.create!(user: users(:one), kind: "digest", to_email: users(:one).email,
        subject: "Bound #{index}", sent_at: Time.current, status: "failed",
        dedupe_key: "envelope-bound-#{index}", error: "x" * 4_000)
    end
    records = catalog.list("email_deliveries", after_id: after_id)[:records]
    byte_limit = records.sum { |record| JSON.generate(record).bytesize }

    stub_const(Admin::Mcp::ResourceCatalog, :MAX_LIST_RESPONSE_BYTES, byte_limit) do
      result = catalog.list("email_deliveries", after_id: after_id)
      assert_operator JSON.generate(result).bytesize, :<=, byte_limit
      assert_equal 1, result[:count]
      assert_equal records.first["id"], result[:next_after_id]
    end
  end
  test "bulk string truncation preserves UTF-8 without exceeding the string budget" do
    record = EmailDelivery.create!(user: users(:one), kind: "digest", to_email: users(:one).email,
      subject: "Unicode", sent_at: Time.current, status: "failed", dedupe_key: "unicode-bound",
      error: "🎁" * 2_000)
    stub_const(Admin::Mcp::ResourceCatalog, :MAX_BULK_STRING_BYTES, 4_001) do
      result = Admin::Mcp::ResourceCatalog.new.list("email_deliveries", filters: { id: record.id })
      error = result[:records].first.fetch("error")
      assert error.valid_encoding?
      assert_operator error.bytesize, :<=, 4_001 + "…".bytesize
    end
  end
end
