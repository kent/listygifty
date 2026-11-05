require "test_helper"

class WellKnownControllerTest < ActionDispatch::IntegrationTest
  test "returns ordinary MCP protected resource metadata at the RFC 9728 path" do
    get "/.well-known/oauth-protected-resource/mcp"

    assert_response :success
    assert_equal "http://www.example.com/mcp", json_response["resource"]
    assert_equal %w[read write], json_response["scopes_supported"]
    assert_equal [ "header" ], json_response["bearer_methods_supported"]
    assert_equal [ "http://www.example.com" ], json_response["authorization_servers"]
    assert_not_includes json_response["scopes_supported"], "admin"
    assert_nil json_response["resource_signing_alg_values_supported"]
  end

  test "returns admin MCP protected resource metadata at the RFC 9728 path" do
    get "/.well-known/oauth-protected-resource/admin/mcp"

    assert_response :success
    assert_equal "http://www.example.com/admin/mcp", json_response["resource"]
    assert_equal [ "admin" ], json_response["scopes_supported"]
    assert_equal "Listy Gifty Admin MCP Server", json_response["resource_name"]
  end

  test "keeps the root protected resource endpoint as ordinary MCP compatibility metadata" do
    get "/.well-known/oauth-protected-resource"

    assert_response :success
    assert_equal "http://www.example.com/mcp", json_response["resource"]
    assert_equal %w[read write], json_response["scopes_supported"]
  end

  test "returns oauth authorization server metadata for both resources" do
    get "/.well-known/oauth-authorization-server"

    assert_response :success
    assert json_response["authorization_endpoint"].end_with?("/oauth/authorize")
    assert json_response["token_endpoint"].end_with?("/oauth/token")
    assert json_response["registration_endpoint"].end_with?("/oauth/register")
    assert json_response["revocation_endpoint"].end_with?("/oauth/revoke")
    assert_equal [ "S256" ], json_response["code_challenge_methods_supported"]
    assert_includes json_response["grant_types_supported"], "refresh_token"
    assert_includes json_response["token_endpoint_auth_methods_supported"], "none"
    assert_equal OauthClient::VALID_AUTH_METHODS, json_response["revocation_endpoint_auth_methods_supported"]
    assert_equal [
      "http://www.example.com/mcp",
      "http://www.example.com/apps/mcp",
      "http://www.example.com/admin/mcp"
    ], json_response["protected_resources"]
  end

  test "returns the apps MCP protected resource metadata at the RFC 9728 path" do
    get "/.well-known/oauth-protected-resource/apps/mcp"

    assert_response :success
    assert_equal "http://www.example.com/apps/mcp", json_response["resource"]
    assert_equal %w[read write], json_response["scopes_supported"]
    assert_equal "Listy Gifty", json_response["resource_name"]
  end

  test "serves the OpenAI domain challenge token as bare text" do
    with_env("OPENAI_APPS_CHALLENGE" => " challenge-token-123\n") do
      get "/.well-known/openai-apps-challenge"
    end

    assert_response :success
    assert_equal "challenge-token-123", response.body
    assert_equal "text/plain", response.media_type
  end

  test "has no OpenAI domain challenge until a token is configured" do
    with_env("OPENAI_APPS_CHALLENGE" => nil) do
      get "/.well-known/openai-apps-challenge"
    end

    assert_response :not_found
  end

  test "does not advertise an OpenID Provider document" do
    get "/.well-known/openid-configuration"

    assert_response :not_found
  end

  private

  def with_env(values)
    previous = values.keys.to_h { |key| [ key, ENV[key] ] }
    values.each { |key, value| ENV[key] = value }
    yield
  ensure
    previous.each { |key, value| ENV[key] = value }
  end
end
