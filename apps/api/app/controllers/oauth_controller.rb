# OAuth 2.1 Authorization Server implementation
# Implements RFC 6749, OAuth 2.1, RFC 7636 (PKCE), RFC 7591 (Dynamic Client Registration)
class OauthController < ApplicationController
  skip_before_action :authenticate!, only: [:authorize, :token, :register, :revoke]

  # GET /oauth/authorize
  # Authorization endpoint - renders consent UI
  def authorize
    @client = OauthClient.active.find_by(client_id: params[:client_id])

    unless @client
      return render_oauth_error("invalid_client", "Unknown client")
    end

    # Validate response_type
    unless params[:response_type] == "code"
      return redirect_with_error(params[:redirect_uri], "unsupported_response_type", params[:state])
    end

    # Validate redirect_uri
    unless @client.valid_redirect_uri?(params[:redirect_uri])
      return render_oauth_error("invalid_request", "Invalid redirect_uri")
    end

    # PKCE validation
    if params[:code_challenge].present?
      unless params[:code_challenge_method] == "S256"
        return redirect_with_error(params[:redirect_uri], "invalid_request", params[:state], "code_challenge_method must be S256")
      end
    elsif !@client.is_system? # PKCE required for non-system clients
      return redirect_with_error(params[:redirect_uri], "invalid_request", params[:state], "PKCE code_challenge is required")
    end

    # Parse requested scopes
    @requested_scopes = (params[:scope] || "read write").split
    invalid_scopes = @requested_scopes - OauthClient::VALID_SCOPES
    if invalid_scopes.any?
      return redirect_with_error(params[:redirect_uri], "invalid_scope", params[:state])
    end

    # Check if user is authenticated via Clerk
    if current_user
      # User is authenticated, show consent screen or auto-approve
      render_consent_screen
    else
      # Store OAuth params in session and redirect to login
      session[:oauth_params] = {
        client_id: params[:client_id],
        redirect_uri: params[:redirect_uri],
        response_type: params[:response_type],
        scope: params[:scope],
        state: params[:state],
        code_challenge: params[:code_challenge],
        code_challenge_method: params[:code_challenge_method],
        resource: params[:resource]
      }

      # Redirect to frontend login with return URL
      redirect_to oauth_login_url, allow_other_host: true
    end
  end

  # POST /oauth/authorize
  # Handles consent form submission
  def authorize_decision
    unless current_user
      return render_oauth_error("access_denied", "User not authenticated")
    end

    client = OauthClient.active.find_by(client_id: params[:client_id])
    unless client
      return render_oauth_error("invalid_client", "Unknown client")
    end

    unless client.valid_redirect_uri?(params[:redirect_uri])
      return render_oauth_error("invalid_request", "Invalid redirect_uri")
    end

    if params[:decision] == "deny"
      return redirect_with_error(params[:redirect_uri], "access_denied", params[:state])
    end

    # Generate authorization code
    scopes = (params[:scope] || "read write").split.select { |s| OauthClient::VALID_SCOPES.include?(s) }

    result = OauthAuthorizationCode.generate_for(
      client: client,
      user: current_user,
      redirect_uri: params[:redirect_uri],
      scopes: scopes,
      code_challenge: params[:code_challenge],
      code_challenge_method: params[:code_challenge_method],
      resource: params[:resource],
      state: params[:state]
    )

    # Redirect back to client with code
    redirect_uri = build_redirect_uri(
      params[:redirect_uri],
      code: result.code,
      state: params[:state]
    )

    redirect_to redirect_uri, allow_other_host: true
  end

  # POST /oauth/token
  # Token endpoint - exchanges codes for tokens, handles refresh
  def token
    case params[:grant_type]
    when "authorization_code"
      handle_authorization_code_grant
    when "refresh_token"
      handle_refresh_token_grant
    else
      render_token_error("unsupported_grant_type")
    end
  end

  # POST /oauth/register
  # Dynamic Client Registration (RFC 7591)
  def register
    # Validate redirect_uris
    unless params[:redirect_uris].is_a?(Array) && params[:redirect_uris].any?
      return render json: { error: "invalid_client_metadata", error_description: "redirect_uris is required" }, status: :bad_request
    end

    begin
      client = OauthClient.dynamic_register(
        client_name: params[:client_name],
        client_description: params[:client_description],
        logo_uri: params[:logo_uri],
        client_uri: params[:client_uri],
        redirect_uris: params[:redirect_uris],
        grant_types: params[:grant_types],
        response_types: params[:response_types],
        token_endpoint_auth_method: params[:token_endpoint_auth_method],
        scopes: params[:scope]&.split || %w[read write]
      )

      render json: client.to_registration_response.merge(
        client_id_issued_at: client.created_at.to_i
      ), status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: "invalid_client_metadata", error_description: e.message }, status: :bad_request
    end
  end

  # POST /oauth/revoke
  # Token revocation (RFC 7009)
  def revoke
    token = params[:token]
    token_type_hint = params[:token_type_hint] || "access_token"

    if token_type_hint == "refresh_token"
      oauth_token = OauthAccessToken.find_by_refresh_token(token)
    else
      oauth_token = OauthAccessToken.find_by_token(token)
    end

    oauth_token&.revoke!

    # Always return 200 OK per RFC 7009
    head :ok
  end

  private

  def handle_authorization_code_grant
    code = params[:code]
    redirect_uri = params[:redirect_uri]
    code_verifier = params[:code_verifier]

    auth_code = OauthAuthorizationCode.find_by_code(code)

    unless auth_code
      return render_token_error("invalid_grant", "Invalid authorization code")
    end

    # Verify client
    client = auth_code.oauth_client
    unless client.client_id == params[:client_id]
      return render_token_error("invalid_client", "Client mismatch")
    end

    # Verify client authentication for confidential clients
    if client.confidential?
      unless authenticate_client(client)
        return render_token_error("invalid_client", "Invalid client credentials")
      end
    end

    # Verify redirect_uri matches
    unless auth_code.redirect_uri == redirect_uri
      return render_token_error("invalid_grant", "Redirect URI mismatch")
    end

    begin
      result = auth_code.exchange!(code_verifier: code_verifier)
      render json: result.access_token.to_token_response(result.token, result.refresh_token)
    rescue OauthError => e
      render_token_error(e.error_code, e.error_description)
    end
  end

  def handle_refresh_token_grant
    refresh_token = params[:refresh_token]

    token = OauthAccessToken.find_by_refresh_token(refresh_token)
    unless token
      return render_token_error("invalid_grant", "Invalid refresh token")
    end

    # Verify client
    client = token.oauth_client
    unless client.client_id == params[:client_id]
      return render_token_error("invalid_client", "Client mismatch")
    end

    # Verify client authentication for confidential clients
    if client.confidential?
      unless authenticate_client(client)
        return render_token_error("invalid_client", "Invalid client credentials")
      end
    end

    begin
      result = token.refresh!(request: request)
      render json: result.access_token.to_token_response(result.token, result.refresh_token)
    rescue OauthError => e
      render_token_error(e.error_code, e.error_description)
    end
  end

  def authenticate_client(client)
    # Check Authorization header for client_secret_basic
    auth_header = request.headers["Authorization"]
    if auth_header&.start_with?("Basic ")
      credentials = Base64.decode64(auth_header.split(" ").last)
      client_id, client_secret = credentials.split(":", 2)
      return client.client_id == client_id && client.verify_secret(client_secret)
    end

    # Check body params for client_secret_post
    if params[:client_secret].present?
      return client.verify_secret(params[:client_secret])
    end

    false
  end

  def render_consent_screen
    # In API-only mode, return JSON that frontend can use to render consent
    render json: {
      client: {
        name: @client.name,
        description: @client.description,
        logo_uri: @client.logo_uri,
        client_uri: @client.client_uri
      },
      requested_scopes: @requested_scopes,
      user: {
        email: current_user.email,
        name: current_user.full_name
      },
      authorization_params: {
        client_id: @client.client_id,
        redirect_uri: params[:redirect_uri],
        scope: params[:scope],
        state: params[:state],
        code_challenge: params[:code_challenge],
        code_challenge_method: params[:code_challenge_method],
        resource: params[:resource]
      }
    }
  end

  def render_oauth_error(error, description = nil)
    render json: { error: error, error_description: description }.compact, status: :bad_request
  end

  def render_token_error(error, description = nil)
    status = case error
    when "invalid_client" then :unauthorized
    else :bad_request
    end

    render json: { error: error, error_description: description }.compact, status: status
  end

  def redirect_with_error(redirect_uri, error, state, description = nil)
    return render_oauth_error(error, description) unless redirect_uri.present?

    uri = build_redirect_uri(redirect_uri, error: error, error_description: description, state: state)
    redirect_to uri, allow_other_host: true
  end

  def build_redirect_uri(base_uri, params)
    uri = URI.parse(base_uri)
    existing_params = URI.decode_www_form(uri.query || "")
    new_params = params.compact.map { |k, v| [k.to_s, v.to_s] }
    uri.query = URI.encode_www_form(existing_params + new_params)
    uri.to_s
  end

  def oauth_login_url
    # Frontend URL for OAuth login flow
    base_url = ENV.fetch("FRONTEND_URL", "http://localhost:3000")
    "#{base_url}/oauth/login"
  end
end
