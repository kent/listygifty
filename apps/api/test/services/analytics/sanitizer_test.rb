require "test_helper"

class Analytics::SanitizerTest < ActiveSupport::TestCase
  test "templates secret-bearing application routes and referrers" do
    assert_equal "/claim/:token", Analytics::Sanitizer.path("/claim/private-claim-token/history")
    assert_equal "/join/:kind/:token", Analytics::Sanitizer.path("/join/exchange/private-invite")
    assert_equal "/e/:slug/:share_token", Analytics::Sanitizer.path("/e/family/private-share")
    assert_equal "/exchange_join/:share_token", Analytics::Sanitizer.path("/exchange_join/private-share/join")
    assert_equal "/holidays/42", Analytics::Sanitizer.path("/holidays/42?source=email")
    assert_equal "https://listygifty.com/w/:token", Analytics::Sanitizer.url("https://listygifty.com/w/private-token?utm_source=email")
  end

  test "keeps safe scalar metrics while dropping nested or identifying values" do
    properties = Analytics::Sanitizer.properties(
      "has_email" => true,
      "addresses_created" => 2,
      "source" => "list_detail_quick_action",
      "path" => "/claim/private-token",
      "email" => "private@example.com",
      "context" => { "email" => "nested@example.com" },
      "innocent_key" => "also-private@example.com",
      "share_token" => "opaque-secret"
    )

    assert_equal true, properties["has_email"]
    assert_equal 2, properties["addresses_created"]
    assert_equal "list_detail_quick_action", properties["source"]
    assert_equal "/claim/:token", properties["path"]
    assert_not properties.key?("email")
    assert_not properties.key?("context")
    assert_not properties.key?("innocent_key")
    assert_not properties.key?("share_token")
  end
end
