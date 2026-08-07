require "test_helper"

class BearerTokenExtractorTest < ActiveSupport::TestCase
  test "extracts a bounded Bearer token with a case-insensitive scheme" do
    token = "lg_oauth_v2_#{"a" * 43}"

    assert_equal token, BearerTokenExtractor.extract("bEaReR #{token}")
    assert_equal token, BearerTokenExtractor.extract("Bearer\t#{token}")
  end

  test "rejects extra credentials, unsafe characters, and oversized headers" do
    token = "lg_oauth_v2_#{"a" * 43}"

    assert_nil BearerTokenExtractor.extract("Bearer junk #{token}")
    assert_nil BearerTokenExtractor.extract("Bearer #{token}!")
    assert_nil BearerTokenExtractor.extract("Bearer #{"a" * 500}")
  end
end
