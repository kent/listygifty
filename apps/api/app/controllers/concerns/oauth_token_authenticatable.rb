# Concern for OAuth 2.0 bearer token authentication
# Used by MCP and other API endpoints that accept OAuth tokens
module OauthTokenAuthenticatable
  extend ActiveSupport::Concern

  included do
    attr_reader :current_oauth_token
  end

  private

  def authenticate_with_oauth_token!
    unless authenticate_with_oauth_token
      response.headers["WWW-Authenticate"] = www_authenticate_header
      render json: {
        error: "invalid_token",
        error_description: "The access token is invalid or has expired"
      }, status: :unauthorized
      return false
    end
    true
  end

  def authenticate_with_oauth_token
    token_string = extract_bearer_token
    return false unless token_string
    return false if token_string.start_with?("ng_") # API key, not OAuth token
    return false unless OauthAccessToken.hardened_access_token?(token_string)

    @current_oauth_token = OauthAccessToken.find_by_token(token_string)
    return false unless @current_oauth_token

    @current_oauth_token.touch_last_used!
    @current_user = @current_oauth_token.user
    Current.user = @current_user
    true
  end

  def extract_bearer_token
    BearerTokenExtractor.extract(request.headers["Authorization"])
  end

  def www_authenticate_header
    parts = [ "Bearer" ]

    resource_metadata = resource_metadata_url
    parts << %(resource_metadata="#{resource_metadata}") if resource_metadata

    required_scope = respond_to?(:required_oauth_scope) ? required_oauth_scope : "read write"
    parts << %(scope="#{required_scope}")

    parts.join(" ")
  end

  def resource_metadata_url
    base_url = ENV.fetch("API_BASE_URL") { request.base_url }.delete_suffix("/")
    "#{base_url}/.well-known/oauth-protected-resource"
  end

  def require_oauth_scope(scope)
    unless @current_oauth_token&.can?(scope)
      response.headers["WWW-Authenticate"] = %(Bearer error="insufficient_scope", scope="#{scope}")
      render json: {
        error: "insufficient_scope",
        error_description: "The access token does not have the '#{scope}' scope"
      }, status: :forbidden
      return false
    end
    true
  end
end
