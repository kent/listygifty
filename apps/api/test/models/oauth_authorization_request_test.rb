require "test_helper"

class OauthAuthorizationRequestTest < ActiveSupport::TestCase
  def setup
    @client = OauthClient.generate(
      name: "Authorization Request Client",
      redirect_uris: [ "https://example.com/callback" ],
      scopes: OauthClient::VALID_SCOPES
    ).client
    verifier = SecureRandom.urlsafe_base64(32)
    @challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
  end

  test "stores only a digest of the browser transaction token" do
    issued = issue

    assert issued.authorization_request.persisted?
    assert_not_equal issued.token, issued.authorization_request.request_digest
    assert_equal issued.authorization_request, OauthAuthorizationRequest.find_by_token(issued.token)
  end

  test "binds inspection to one user" do
    issued = issue
    issued.authorization_request.claim!(users(:one))

    error = assert_raises(OauthError) do
      issued.authorization_request.claim!(users(:two))
    end
    assert_equal "access_denied", error.error_code
  end

  test "expires and consumes once" do
    issued = issue
    issued.authorization_request.consume!(decision: "approve")

    assert issued.authorization_request.consumed?
    assert_raises(OauthError) { issued.authorization_request.consume!(decision: "deny") }

    expired = issue.authorization_request
    travel 11.minutes do
      assert expired.expired?
      assert_raises(OauthError) { expired.claim!(users(:one)) }
    end
  end

  private

  def issue
    OauthAuthorizationRequest.issue!(
      client: @client,
      redirect_uri: "https://example.com/callback",
      scopes: [ "read" ],
      code_challenge: @challenge,
      resource: "https://api.example.com/mcp",
      state: "state"
    )
  end
end
