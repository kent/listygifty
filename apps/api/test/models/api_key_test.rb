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

  test "find_by_raw_key returns nil for matching prefix with wrong secret" do
    result = ApiKey.generate_for(@user, name: "Test")
    actual_key = result.raw_key.delete_prefix("ng_")
    bad_key = "ng_#{actual_key[0..7]}#{'x' * (actual_key.length - 8)}"

    assert_nil ApiKey.find_by_raw_key(bad_key)
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

  test "find_by_raw_key does not write last_used_at more than once every five minutes" do
    result = ApiKey.generate_for(@user, name: "Test")
    ApiKey.find_by_raw_key(result.raw_key)
    first_used_at = result.api_key.reload.last_used_at

    ApiKey.find_by_raw_key(result.raw_key)
    assert_equal first_used_at, result.api_key.reload.last_used_at
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
    assert_in_delta 30.days.from_now, result.api_key.expires_at, 2.seconds
    assert result.api_key.admin_compliant?
  end

  test "admin keys reject mixed scopes, missing expiry, and expiry beyond thirty days" do
    attributes = {
      user: @user,
      name: "Unsafe admin",
      key_prefix: "abcdefgh",
      key_hash: "x" * 64,
      scopes: %w[admin read]
    }
    mixed = ApiKey.new(attributes.merge(expires_at: 1.day.from_now))
    assert_not mixed.valid?
    assert mixed.errors[:scopes].any?

    missing_expiry = ApiKey.new(attributes.merge(scopes: %w[admin]))
    assert_not missing_expiry.valid?
    assert missing_expiry.errors[:expires_at].any?

    long_expiry = ApiKey.new(attributes.merge(scopes: %w[admin], expires_at: 31.days.from_now))
    assert_not long_expiry.valid?
    assert long_expiry.errors[:expires_at].any?
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
