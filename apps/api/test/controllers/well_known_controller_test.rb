require "test_helper"

class WellKnownControllerTest < ActionDispatch::IntegrationTest
  test "returns oauth protected resource metadata" do
    get "/.well-known/oauth-protected-resource"

    assert_response :success
    json = JSON.parse(response.body)

    assert json["resource"].present?
    assert json["authorization_servers"].is_a?(Array)
    assert json["scopes_supported"].is_a?(Array)
    assert_includes json["scopes_supported"], "read"
    assert_includes json["scopes_supported"], "write"
    assert_equal ["header"], json["bearer_methods_supported"]
  end

  test "returns oauth authorization server metadata" do
    get "/.well-known/oauth-authorization-server"

    assert_response :success
    json = JSON.parse(response.body)

    assert json["issuer"].present?
    assert json["authorization_endpoint"].include?("/oauth/authorize")
    assert json["token_endpoint"].include?("/oauth/token")
    assert json["registration_endpoint"].include?("/oauth/register")
    assert json["revocation_endpoint"].include?("/oauth/revoke")

    assert_includes json["response_types_supported"], "code"
    assert_includes json["grant_types_supported"], "authorization_code"
    assert_includes json["grant_types_supported"], "refresh_token"
    assert_includes json["code_challenge_methods_supported"], "S256"
    assert_includes json["token_endpoint_auth_methods_supported"], "none"

    # Client ID Metadata Document support
    assert json["client_id_metadata_document_supported"]
  end

  test "returns openid configuration for compatibility" do
    get "/.well-known/openid-configuration"

    assert_response :success
    json = JSON.parse(response.body)

    assert json["issuer"].present?
    assert json["authorization_endpoint"].present?
    assert json["token_endpoint"].present?
    assert_includes json["code_challenge_methods_supported"], "S256"
  end
end
