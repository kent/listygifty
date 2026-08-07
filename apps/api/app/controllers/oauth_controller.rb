# OAuth 2.1 authorization server for the user and admin MCP resources.
class OauthController < ApplicationController
  MAX_STATE_LENGTH = 1_024

  skip_before_action :authenticate!, only: %i[authorize consent authorize_decision token register revoke]
  before_action :authenticate_clerk_authorizer!, only: %i[consent authorize_decision]
  before_action :ensure_oauth_issuance_enabled!, only: %i[authorize consent authorize_decision token register]
  before_action :require_registration_json!, only: :register
  before_action :validate_registration_origin!, only: :register
  before_action :set_oauth_security_headers
  after_action :set_oauth_security_headers

  # GET /oauth/authorize
  # Validates and freezes the authorization request before handing off to the
  # first-party browser login and consent page.
  def authorize
    return unless prepare_initial_authorization_request

    issued = OauthAuthorizationRequest.issue!(
      client: @client,
      redirect_uri: @validated_redirect_uri,
      scopes: @requested_scopes,
      code_challenge: params[:code_challenge],
      resource: @oauth_resource.uri,
      state: @validated_state
    )

    redirect_to oauth_consent_url(issued.token), allow_other_host: true
  end

  # POST /oauth/authorize/consent
  # Returns display-only consent data to the authenticated Listy Gifty UI.
  def consent
    authorization_request = claimed_authorization_request!
    return if performed?

    render json: {
      client: {
        name: authorization_request.oauth_client.name,
        description: authorization_request.oauth_client.description,
        client_uri: authorization_request.oauth_client.client_uri,
        redirect_uri: authorization_request.redirect_uri,
        dynamically_registered: authorization_request.oauth_client.is_dynamic?,
        verified: authorization_request.oauth_client.is_system?
      },
      resource: {
        name: @oauth_resource.name,
        uri: @oauth_resource.uri,
        admin: @oauth_resource.admin
      },
      requested_scopes: authorization_request.scopes,
      user: {
        email: current_user.email,
        name: current_user.safe_name
      },
      expires_at: authorization_request.expires_at.iso8601
    }
  end

  # POST /oauth/authorize
  # Consumes the immutable request exactly once and returns the registered
  # callback URL for the first-party UI to navigate to.
  def authorize_decision
    authorization_request = claimed_authorization_request!
    return if performed?

    decision = params[:decision].to_s
    unless OauthAuthorizationRequest::DECISIONS.include?(decision)
      return render_oauth_error("invalid_request", "decision must be approve or deny")
    end

    redirect_uri = authorization_request.with_lock do
      validate_claimed_authorization_request!(authorization_request)

      if decision == "deny"
        authorization_request.consume!(decision: decision)
        build_redirect_uri(
          authorization_request.redirect_uri,
          error: "access_denied",
          state: authorization_request.state
        )
      else
        result = OauthAuthorizationCode.generate_for(
          client: authorization_request.oauth_client,
          user: current_user,
          redirect_uri: authorization_request.redirect_uri,
          scopes: authorization_request.scopes,
          code_challenge: authorization_request.code_challenge,
          code_challenge_method: authorization_request.code_challenge_method,
          resource: authorization_request.resource,
          state: authorization_request.state
        )
        authorization_request.consume!(decision: decision)
        build_redirect_uri(
          authorization_request.redirect_uri,
          code: result.code,
          state: authorization_request.state
        )
      end
    end

    render json: { redirect_uri: redirect_uri }
  rescue OauthError => e
    render_oauth_error(e.error_code, e.error_description)
  end

  # POST /oauth/token
  def token
    if basic_authentication_attempted? && params.key?(:client_secret)
      return render_token_error("invalid_request", "Use only one client authentication mechanism")
    end

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
  # Public MCP clients use DCR and PKCE. Open registration creates public
  # clients only; client secrets are never returned by this endpoint.
  def register
    return unless valid_registration_metadata?

    auth_method = params[:token_endpoint_auth_method].presence || "none"
    unless auth_method == "none"
      return render json: {
        error: "invalid_client_metadata",
        error_description: "Dynamic MCP clients must use token_endpoint_auth_method none"
      }, status: :bad_request
    end

    client = OauthClient.dynamic_register(
      client_name: params[:client_name],
      client_description: params[:client_description],
      logo_uri: params[:logo_uri],
      client_uri: params[:client_uri],
      redirect_uris: params[:redirect_uris],
      grant_types: params[:grant_types],
      response_types: params[:response_types],
      token_endpoint_auth_method: auth_method,
      scopes: params.key?(:scope) ? params[:scope].split : OauthClient::VALID_SCOPES
    )

    render json: client.to_registration_response.merge(client_id_issued_at: client.created_at.to_i), status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: "invalid_client_metadata", error_description: e.record.errors.full_messages.join(", ") }, status: :bad_request
  end

  # POST /oauth/revoke
  def revoke
    if basic_authentication_attempted? && params.key?(:client_secret)
      return render_token_error("invalid_request", "Use only one client authentication mechanism")
    end

    refresh_credential = OauthAccessToken.find_by_refresh_token(params[:token])
    credential = refresh_credential || OauthAccessToken.find_by_token_for_revocation(params[:token])
    return head :ok unless credential

    client = credential.oauth_client
    return head :ok unless client.client_id == presented_client_id
    return unless valid_client_authentication?(client)

    credential.revoke_refresh_family!
    head :ok
  end

  private

  def ensure_oauth_issuance_enabled!
    return unless ENV.fetch("OAUTH_ISSUANCE_ENABLED", "true") == "false"

    response.headers["Retry-After"] = "60"
    render json: {
      error: "temporarily_unavailable",
      error_description: "OAuth issuance is temporarily disabled for maintenance"
    }, status: :service_unavailable
  end

  def valid_registration_metadata?
    redirect_uris = params[:redirect_uris]
    unless redirect_uris.is_a?(Array) && redirect_uris.length.between?(1, 20) && redirect_uris.all? { |uri| uri.is_a?(String) && uri.bytesize <= 2_000 }
      render json: {
        error: "invalid_client_metadata",
        error_description: "redirect_uris must contain 1-20 URI strings"
      }, status: :bad_request
      return false
    end

    %i[grant_types response_types].each do |attribute|
      value = params[attribute]
      next if value.nil?
      unless value.is_a?(Array) && value.length.between?(1, 20) && value.all? { |item| item.is_a?(String) }
        render json: {
          error: "invalid_client_metadata",
          error_description: "#{attribute} must contain 1-20 strings"
        }, status: :bad_request
        return false
      end
    end

    if params.key?(:scope) &&
        (!params[:scope].is_a?(String) || params[:scope].empty? || params[:scope].bytesize > 500)
      render json: { error: "invalid_client_metadata", error_description: "scope must be a non-empty string" }, status: :bad_request
      return false
    end

    {
      client_name: 200,
      client_description: 2_000,
      logo_uri: 2_000,
      client_uri: 2_000,
      token_endpoint_auth_method: 100
    }.each do |attribute, max_length|
      value = params[attribute]
      next if value.nil?
      unless value.is_a?(String) && value.bytesize <= max_length
        render json: { error: "invalid_client_metadata", error_description: "#{attribute} is invalid" }, status: :bad_request
        return false
      end
    end

    true
  end

  def authenticate_clerk_authorizer!
    authenticate_clerk_session!
  end

  def prepare_initial_authorization_request
    client_id = params[:client_id]
    unless client_id.is_a?(String) && client_id.bytesize <= 500
      return render_oauth_error("invalid_client", "Unknown client")
    end

    @client = OauthClient.active.find_by(client_id: client_id)
    return render_oauth_error("invalid_client", "Unknown client") unless @client

    if params.key?(:redirect_uri)
      redirect_uri = params[:redirect_uri]
      unless redirect_uri.is_a?(String) && redirect_uri.bytesize <= 2_000
        return render_oauth_error("invalid_request", "Invalid redirect_uri")
      end
      @validated_redirect_uri = @client.resolve_redirect_uri(redirect_uri)
    elsif @client.redirect_uris.one?
      @validated_redirect_uri = @client.redirect_uris.first
    end
    unless @validated_redirect_uri
      return render_oauth_error("invalid_request", "redirect_uri is required unless exactly one URI is registered")
    end

    if params[:state].present? && (!params[:state].is_a?(String) || params[:state].bytesize > MAX_STATE_LENGTH)
      @validated_state = nil
      return redirect_authorization_error("invalid_request", "state is invalid")
    end
    @validated_state = params[:state]

    unless params[:response_type] == "code" && @client.supports_response_type?("code")
      return redirect_authorization_error("unsupported_response_type")
    end

    unless params[:resource].is_a?(String) && params[:resource].bytesize <= 2_000
      return redirect_authorization_error("invalid_target", "resource is required")
    end

    begin
      @oauth_resource = resource_registry.fetch(params[:resource])
    rescue OauthError => e
      return redirect_authorization_error(e.error_code, e.error_description)
    end

    if params.key?(:scope) &&
        (!params[:scope].is_a?(String) || params[:scope].empty? || params[:scope].bytesize > 500)
      return redirect_authorization_error("invalid_scope")
    end
    @requested_scopes = (params.key?(:scope) ? params[:scope] : @oauth_resource.scopes.join(" ")).split.uniq
    invalid_scopes = @requested_scopes - OauthClient::VALID_SCOPES
    invalid_scopes |= @requested_scopes - @oauth_resource.scopes
    invalid_scopes |= @requested_scopes.reject { |scope| @client.can_request_scope?(scope) }
    return redirect_authorization_error("invalid_scope") if @requested_scopes.empty? || invalid_scopes.any?

    unless params[:code_challenge_method] == "S256" && params[:code_challenge].to_s.match?(OauthAuthorizationCode::PKCE_CHALLENGE)
      return redirect_authorization_error("invalid_request", "S256 PKCE code_challenge is required")
    end

    true
  end

  def claimed_authorization_request!
    authorization_request = OauthAuthorizationRequest.find_by_token(params[:request_token])
    unless authorization_request
      render_oauth_error("invalid_request", "Unknown authorization request")
      return nil
    end

    authorization_request.claim!(current_user)
    validate_claimed_authorization_request!(authorization_request)
    authorization_request
  rescue OauthError => e
    status = e.error_code == "access_denied" ? :forbidden : :bad_request
    render json: e.to_h, status: status
    nil
  end

  def validate_claimed_authorization_request!(authorization_request)
    client = authorization_request.oauth_client
    raise OauthError.new("invalid_client", "OAuth client has been revoked") unless client.active?

    resource = resource_registry.find(authorization_request.resource)
    raise OauthError.new("invalid_target", "Unknown or unsupported OAuth resource") unless resource

    invalid_scopes = authorization_request.scopes - resource.scopes
    invalid_scopes |= authorization_request.scopes.reject { |scope| client.can_request_scope?(scope) }
    raise OauthError.new("invalid_scope", "Scopes are not valid for this resource") if invalid_scopes.any?

    if resource.admin && !Admin::Authorization.allowed?(current_user)
      raise OauthError.new("access_denied", "This account is not authorized for Listy Gifty administration")
    end

    @oauth_resource = resource
  end

  def handle_authorization_code_grant
    auth_code = OauthAuthorizationCode.find_by_code(params[:code])
    return render_token_error("invalid_grant", "Invalid authorization code") unless auth_code

    client = auth_code.oauth_client
    return render_token_error("invalid_grant", "Credential was not issued to this client") unless client.client_id == presented_client_id
    return render_token_error("unauthorized_client") unless client.supports_grant_type?("authorization_code")
    return unless valid_client_authentication?(client)
    if params.key?(:redirect_uri) && auth_code.redirect_uri != params[:redirect_uri]
      return render_token_error("invalid_grant", "Redirect URI mismatch")
    end
    return render_token_error("invalid_target", "resource must match the authorization request") unless valid_token_resource?(auth_code.resource)

    resource = resource_registry.find(auth_code.resource)
    if resource&.admin && !Admin::Authorization.allowed?(auth_code.user)
      return render_token_error("invalid_grant", "Administrator access is no longer allowed")
    end

    verifier = params[:code_verifier].to_s
    return render_token_error("invalid_grant", "Invalid PKCE code_verifier") unless verifier.match?(OauthAuthorizationCode::PKCE_VERIFIER)

    result = auth_code.exchange!(code_verifier: verifier, request: request)
    render json: result.access_token.to_token_response(result.token, result.refresh_token)
  rescue OauthError => e
    render_token_error(e.error_code, e.error_description)
  end

  def handle_refresh_token_grant
    oauth_token = OauthAccessToken.find_by_refresh_token(params[:refresh_token])
    return render_token_error("invalid_grant", "Invalid refresh token") unless oauth_token

    client = oauth_token.oauth_client
    return render_token_error("invalid_grant", "Credential was not issued to this client") unless client.client_id == presented_client_id
    return render_token_error("unauthorized_client") unless client.supports_grant_type?("refresh_token")
    return unless valid_client_authentication?(client)
    return render_token_error("invalid_target", "resource must match the original grant") unless valid_token_resource?(oauth_token.resource)

    resource = resource_registry.find(oauth_token.resource)
    if resource&.admin && !Admin::Authorization.allowed?(oauth_token.user)
      return render_token_error("invalid_grant", "Administrator access is no longer allowed")
    end

    requested_scopes = validated_refresh_scopes(oauth_token)
    return if performed?

    result = oauth_token.refresh!(request: request, scopes: requested_scopes)
    render json: result.access_token.to_token_response(result.token, result.refresh_token)
  rescue OauthError => e
    if e.error_code == "temporarily_unavailable"
      response.headers["Retry-After"] = OauthRefreshGrant::MIN_ROTATION_INTERVAL.to_i.to_s
      render_token_error(e.error_code, e.error_description, status: :too_many_requests)
    else
      render_token_error(e.error_code, e.error_description)
    end
  end

  def validated_refresh_scopes(oauth_token)
    grant_scopes = oauth_token.oauth_refresh_grant&.scopes || []
    return grant_scopes unless params.key?(:scope)

    unless params[:scope].is_a?(String) && params[:scope].bytesize <= 500
      render_token_error("invalid_scope")
      return nil
    end

    requested_scopes = params[:scope].split.uniq.sort
    if requested_scopes.empty? || (requested_scopes - grant_scopes).any?
      render_token_error("invalid_scope", "Requested scope exceeds the original grant")
      return nil
    end

    requested_scopes
  end

  def valid_client_authentication?(client)
    if client.public_client?
      if basic_authentication_attempted? || params.key?(:client_secret)
        render_token_error("invalid_client", "Public clients must not send a client secret")
        return false
      end
      return true
    end

    return true if authenticate_client(client)

    render_token_error("invalid_client", "Invalid client credentials")
    false
  end

  def valid_token_resource?(expected_resource)
    params[:resource].present? && params[:resource] == expected_resource && resource_registry.find(expected_resource).present?
  end

  def authenticate_client(client)
    case client.token_endpoint_auth_method
    when "client_secret_basic"
      client_id, client_secret = basic_client_credentials
      client.client_id == client_id && client.verify_secret(client_secret)
    when "client_secret_post"
      client.client_id == params[:client_id] && client.verify_secret(params[:client_secret])
    else
      false
    end
  end

  def presented_client_id
    params[:client_id].presence || basic_client_credentials&.first
  end

  def basic_authentication_attempted?
    request.headers["Authorization"].to_s.match?(/\ABasic(?:[ \t]|$)/i)
  end

  def basic_client_credentials
    return @basic_client_credentials if defined?(@basic_client_credentials)

    auth_header = request.headers["Authorization"]
    unless auth_header.is_a?(String) && auth_header.bytesize <= 4_096
      return @basic_client_credentials = nil
    end
    basic_match = /\ABasic[ \t]+(.+)\z/i.match(auth_header)
    return @basic_client_credentials = nil unless basic_match

    encoded_id, encoded_secret = Base64.strict_decode64(basic_match[1]).split(":", 2)
    return @basic_client_credentials = nil unless encoded_id && encoded_secret

    @basic_client_credentials = [
      URI.decode_www_form_component(encoded_id),
      URI.decode_www_form_component(encoded_secret)
    ]
  rescue ArgumentError
    @basic_client_credentials = nil
  end

  def render_oauth_error(error, description = nil)
    render json: { error: error, error_description: description }.compact, status: :bad_request
    false
  end

  def render_token_error(error, description = nil, status: nil)
    basic_attempted = basic_authentication_attempted?
    if error == "invalid_client" && basic_attempted
      response.headers["WWW-Authenticate"] = 'Basic realm="Listy Gifty OAuth Token Endpoint", charset="UTF-8"'
    end
    status ||= error == "invalid_client" && basic_attempted ? :unauthorized : :bad_request
    render json: { error: error, error_description: description }.compact, status: status
  end

  def redirect_authorization_error(error, description = nil)
    redirect_to build_redirect_uri(
      @validated_redirect_uri,
      error: error,
      error_description: description,
      state: @validated_state
    ), allow_other_host: true
    false
  end

  def build_redirect_uri(base_uri, values)
    uri = URI.parse(base_uri)
    existing_params = URI.decode_www_form(uri.query || "")
    additions = values.compact.map { |key, value| [ key.to_s, value.to_s ] }
    uri.query = URI.encode_www_form(existing_params + additions)
    uri.to_s
  end

  def oauth_consent_url(request_token)
    base_url = ENV.fetch("FRONTEND_URL", "http://localhost:3000").delete_suffix("/")
    uri = URI.parse("#{base_url}/oauth/authorize")
    uri.query = URI.encode_www_form(request_token: request_token)
    uri.to_s
  end

  def resource_registry
    @resource_registry ||= Oauth::ResourceRegistry.new(base_url: request.base_url)
  end

  def require_registration_json!
    return if request.media_type == "application/json"

    render json: {
      error: "invalid_request",
      error_description: "Dynamic client registration requires application/json"
    }, status: :unsupported_media_type
  end

  def validate_registration_origin!
    origin = request.headers["Origin"]
    return if origin.blank?

    allowed_origins = ENV.fetch(
      "MCP_ALLOWED_ORIGINS",
      "https://listygifty.com,https://www.listygifty.com"
    ).split(",").map(&:strip).reject(&:blank?)
    return if allowed_origins.include?(origin)

    render json: {
      error: "invalid_request",
      error_description: "Origin is not allowed"
    }, status: :forbidden
  end

  def set_oauth_security_headers
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
  end
end
