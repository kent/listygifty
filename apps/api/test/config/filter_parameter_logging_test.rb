require "test_helper"

class FilterParameterLoggingTest < ActiveSupport::TestCase
  test "filters OAuth codes and verifiers without hiding unrelated code fields" do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    filtered = filter.filter(
      "code" => "one-time-authorization-code",
      "code_verifier" => "pkce-verifier",
      "access_token" => "access-token",
      "refresh_token" => "refresh-token",
      "request_token" => "browser-transaction-token",
      "postal_code" => "90210",
      "code_challenge" => "public-pkce-challenge"
    )

    %w[code code_verifier access_token refresh_token request_token].each do |key|
      assert_equal "[FILTERED]", filtered[key]
    end
    assert_equal "90210", filtered["postal_code"]
    assert_equal "public-pkce-challenge", filtered["code_challenge"]
  end
end
