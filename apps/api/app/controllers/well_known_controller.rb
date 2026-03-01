# OAuth 2.0 Discovery endpoints
# Implements RFC 9728 (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata)
class WellKnownController < ApplicationController
  skip_before_action :authenticate!

  # GET /.well-known/oauth-protected-resource
  # RFC 9728 - Protected Resource Metadata
  def oauth_protected_resource
    render json: {
      resource: mcp_server_uri,
      authorization_servers: [ authorization_server_uri ],
      scopes_supported: OauthClient::VALID_SCOPES,
      bearer_methods_supported: [ "header" ],
      resource_documentation: "https://docs.listygifty.com/mcp",
      resource_signing_alg_values_supported: [ "none" ],
      resource_name: "ListyGifty MCP Server"
    }
  end

  # GET /.well-known/oauth-authorization-server
  # RFC 8414 - Authorization Server Metadata
  def oauth_authorization_server
    render json: {
      issuer: authorization_server_uri,
      authorization_endpoint: "#{api_base_url}/oauth/authorize",
      token_endpoint: "#{api_base_url}/oauth/token",
      registration_endpoint: "#{api_base_url}/oauth/register",
      revocation_endpoint: "#{api_base_url}/oauth/revoke",
      scopes_supported: OauthClient::VALID_SCOPES,
      response_types_supported: [ "code" ],
      response_modes_supported: [ "query" ],
      grant_types_supported: [ "authorization_code", "refresh_token" ],
      token_endpoint_auth_methods_supported: [ "none", "client_secret_basic", "client_secret_post" ],
      code_challenge_methods_supported: [ "S256" ],
      service_documentation: "https://docs.listygifty.com/oauth",
      ui_locales_supported: [ "en" ],
      op_policy_uri: "https://listygifty.com/privacy",
      op_tos_uri: "https://listygifty.com/terms",
      # Client ID Metadata Document support
      client_id_metadata_document_supported: true
    }
  end

  # GET /.well-known/openid-configuration
  # OpenID Connect Discovery 1.0 (for compatibility)
  def openid_configuration
    render json: {
      issuer: authorization_server_uri,
      authorization_endpoint: "#{api_base_url}/oauth/authorize",
      token_endpoint: "#{api_base_url}/oauth/token",
      registration_endpoint: "#{api_base_url}/oauth/register",
      revocation_endpoint: "#{api_base_url}/oauth/revoke",
      scopes_supported: OauthClient::VALID_SCOPES + [ "openid" ],
      response_types_supported: [ "code" ],
      response_modes_supported: [ "query" ],
      grant_types_supported: [ "authorization_code", "refresh_token" ],
      token_endpoint_auth_methods_supported: [ "none", "client_secret_basic", "client_secret_post" ],
      code_challenge_methods_supported: [ "S256" ],
      # Mark that we don't actually support full OIDC
      id_token_signing_alg_values_supported: [],
      claims_supported: [],
      subject_types_supported: [ "public" ]
    }
  end

  private

  def api_base_url
    ENV.fetch("API_BASE_URL") { request.base_url }
  end

  def authorization_server_uri
    api_base_url
  end

  def mcp_server_uri
    ENV.fetch("MCP_SERVER_URI") { "#{api_base_url}/mcp" }
  end
end
