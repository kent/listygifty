require "test_helper"

class Analytics::AttributionTest < ActiveSupport::TestCase
  test "classifies paid, owned, organic, referral, and direct channels" do
    assert_equal "paid_search", classify(utm_medium: "cpc")
    assert_equal "paid_social", classify(fbclid: "123")
    assert_equal "email", classify(utm_medium: "newsletter")
    assert_equal "affiliate", classify(utm_medium: "partner")
    assert_equal "display", classify(utm_medium: "cpm")
    assert_equal "organic_search", classify({}, referrer: "https://duckduckgo.com/?q=gifts")
    assert_equal "organic_social", classify({}, referrer: "https://instagram.com/listygifty")
    assert_equal "referral", classify({}, referrer: "https://example.com/article")
    assert_equal "direct", classify
  end

  test "normalizes reporting dimensions and ignores first-party referrers" do
    result = Analytics::Attribution.normalize(
      { utm_source: " Google ", utm_medium: "CPC", utm_campaign: "Holiday-Launch" },
      referrer: "https://www.listygifty.com/w/private-token"
    )

    assert_equal "google", result["utm_source"]
    assert_equal "cpc", result["utm_medium"]
    assert_equal "holiday-launch", result["utm_campaign"]
    assert_nil result["referrer_host"]
    assert_equal "paid_search", result["channel"]
  end

  private

  def classify(values = {}, referrer: nil, **attributes)
    Analytics::Attribution.normalize(values.merge(attributes), referrer: referrer).fetch("channel")
  end
end
