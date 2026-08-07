# OAuth 2.0 discovery for the Listy Gifty MCP resources.
class WellKnownController < ApplicationController
  skip_before_action :authenticate!

  # Compatibility endpoint retained for older clients. Standards-compliant
  # clients use the resource-path endpoints below.
  def oauth_protected_resource
    render_resource_metadata(resource_registry.user_mcp)
  end

  def oauth_user_mcp_protected_resource
    render_resource_metadata(resource_registry.user_mcp)
  end

  def oauth_admin_mcp_protected_resource
    render_resource_metadata(resource_registry.admin_mcp)
  end

  def oauth_authorization_server
    render json: authorization_server_metadata
  end

  private

  def render_resource_metadata(resource)
    response.headers["Cache-Control"] = "public, max-age=3600"
    render json: {
      resource: resource.uri,
      authorization_servers: [ authorization_server_uri ],
      scopes_supported: resource.scopes,
      bearer_methods_supported: [ "header" ],
      resource_documentation: "https://docs.listygifty.com/mcp",
      resource_name: resource.name
    }
  end

  def authorization_server_metadata
    response.headers["Cache-Control"] = "public, max-age=3600"
    {
      issuer: authorization_server_uri,
      authorization_endpoint: "#{api_base_url}/oauth/authorize",
      token_endpoint: "#{api_base_url}/oauth/token",
      registration_endpoint: "#{api_base_url}/oauth/register",
      revocation_endpoint: "#{api_base_url}/oauth/revoke",
      protected_resources: resource_registry.resources.map(&:uri),
      scopes_supported: OauthClient::VALID_SCOPES,
      response_types_supported: [ "code" ],
      response_modes_supported: [ "query" ],
      grant_types_supported: [ "authorization_code", "refresh_token" ],
      token_endpoint_auth_methods_supported: OauthClient::VALID_AUTH_METHODS,
      revocation_endpoint_auth_methods_supported: OauthClient::VALID_AUTH_METHODS,
      code_challenge_methods_supported: [ "S256" ],
      service_documentation: "https://docs.listygifty.com/oauth",
      ui_locales_supported: [ "en" ],
      op_policy_uri: "https://listygifty.com/privacy",
      op_tos_uri: "https://listygifty.com/terms"
    }
  end

  def api_base_url
    ENV.fetch("API_BASE_URL") { request.base_url }.delete_suffix("/")
  end

  def authorization_server_uri
    api_base_url
  end

  def resource_registry
    @resource_registry ||= Oauth::ResourceRegistry.new(base_url: api_base_url)
  end
end
