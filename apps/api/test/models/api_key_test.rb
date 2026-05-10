require "test_helper"

class ApiKeyTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
  end

  test "generate_for returns record and raw key prefixed with ng_" do
    result = ApiKey.generate_for(@user, name: "Test")
    assert_kind_of ApiKey, result.api_key
    assert result.raw_key.start_with?("ng_")
    assert_equal @user, result.api_key.user
    assert_equal "Test", result.api_key.name
  end

  test "generate_for stores hashed key, not raw key" do
    result = ApiKey.generate_for(@user, name: "Test")
    refute_includes result.api_key.key_hash, result.raw_key
    assert_equal 64, result.api_key.key_hash.length # SHA256 hex
  end

  test "find_by_raw_key returns key for valid raw key" do
    result = ApiKey.generate_for(@user, name: "Test")
    found = ApiKey.find_by_raw_key(result.raw_key)
    assert_equal result.api_key.id, found.id
  end

  test "find_by_raw_key returns nil for raw key without ng_ prefix" do
    result = ApiKey.generate_for(@user, name: "Test")
    bad_key = result.raw_key.delete_prefix("ng_")
    assert_nil ApiKey.find_by_raw_key(bad_key)
  end

  test "find_by_raw_key returns nil for tampered key" do
    ApiKey.generate_for(@user, name: "Test")
    assert_nil ApiKey.find_by_raw_key("ng_invalidkeythatdoesnotexist123")
  end

  test "find_by_raw_key returns nil for revoked key" do
    result = ApiKey.generate_for(@user, name: "Test")
    result.api_key.revoke!
    assert_nil ApiKey.find_by_raw_key(result.raw_key)
  end

  test "find_by_raw_key returns nil for expired key" do
    result = ApiKey.generate_for(@user, name: "Test", expires_at: 1.day.ago)
    assert_nil ApiKey.find_by_raw_key(result.raw_key)
  end

  test "find_by_raw_key updates last_used_at" do
    result = ApiKey.generate_for(@user, name: "Test")
    assert_nil result.api_key.last_used_at
    ApiKey.find_by_raw_key(result.raw_key)
    assert_not_nil result.api_key.reload.last_used_at
  end

  test "can? returns true for explicit scope" do
    result = ApiKey.generate_for(@user, name: "Test", scopes: %w[read])
    assert result.api_key.can?(:read)
    refute result.api_key.can?(:write)
  end

  test "admin scope grants any scope" do
    result = ApiKey.generate_for(@user, name: "Test", scopes: %w[admin])
    assert result.api_key.can?(:read)
    assert result.api_key.can?(:write)
    assert result.api_key.can?(:admin)
  end

  test "revoked? and active? track revoke state" do
    result = ApiKey.generate_for(@user, name: "Test")
    assert result.api_key.active?
    refute result.api_key.revoked?

    result.api_key.revoke!
    assert result.api_key.revoked?
    refute result.api_key.active?
  end

  test "masked_key returns prefix only, not full key" do
    result = ApiKey.generate_for(@user, name: "Test")
    masked = result.api_key.masked_key
    assert masked.start_with?("ng_")
    assert masked.end_with?("...")
    # Masked must be shorter than the full raw key (cannot be used to reconstruct it)
    assert masked.length < result.raw_key.length
  end

  test "validates scopes" do
    invalid = ApiKey.new(
      user: @user,
      name: "Test",
      key_prefix: "abcdefgh",
      key_hash: "x" * 64,
      scopes: %w[read invalid_scope]
    )
    refute invalid.valid?
    assert_includes invalid.errors[:scopes].first, "invalid_scope"
  end
end
