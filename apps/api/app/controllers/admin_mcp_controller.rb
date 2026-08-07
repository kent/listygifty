class AdminMcpController < ApplicationController
  include McpTransportSecurity

  SUPPORTED_PROTOCOL_VERSIONS = McpTransportSecurity::SUPPORTED_PROTOCOL_VERSIONS
  MAX_REQUEST_BYTES = 256.kilobytes
  MAX_JSON_DEPTH = 32
  MAX_METHOD_LENGTH = 100

  skip_before_action :authenticate!
  before_action :set_security_headers
  before_action :ensure_admin_mcp_enabled!
  before_action :validate_content_type!
  before_action :validate_origin!
  before_action :validate_mcp_protocol_version!
  before_action :authenticate_admin_credential!
  after_action :set_security_headers

  def connect
    response.headers["Allow"] = "POST"
    head :method_not_allowed
  end

  def handle
    raw_body = bounded_request_body
    return if performed?

    body = JSON.parse(raw_body, max_nesting: MAX_JSON_DEPTH)
    if body.is_a?(Array)
      render json: jsonrpc_error(nil, -32600, "Batch requests are not supported"), status: :bad_request
    else
      response = process_request(body)
      response ? render(json: response) : head(:accepted)
    end
  rescue JSON::ParserError, JSON::NestingError
    render json: jsonrpc_error(nil, -32700, "Parse error")
  end

  private

  def authenticate_admin_credential!
    raw_token = extract_admin_bearer_token
    return render_admin_unauthorized("Admin OAuth login or API key required") unless raw_token

    credential_record = ApiKey.find_by_raw_key(raw_token) || OauthAccessToken.find_by_token(raw_token)
    return render_admin_unauthorized("Invalid or expired admin credential", invalid_token: true) unless credential_record

    @current_user = credential_record.user
    unless valid_admin_credential?(credential_record, raw_token)
      audit_authorization_denied(credential_record)
      if credential_record.is_a?(OauthAccessToken)
        return render_admin_unauthorized("OAuth token is not valid for the admin MCP", invalid_token: true)
      end
      return render json: { error: "This API key is not authorized for Listy Gifty administration" }, status: :forbidden
    end

    unless Admin::Authorization.allowed?(@current_user)
      audit_authorization_denied(credential_record)
      return render json: { error: "This account is not authorized for Listy Gifty administration" }, status: :forbidden
    end

    credential_record.touch_last_used! if credential_record.is_a?(OauthAccessToken)
    @admin_credential = Admin::Credential.new(credential_record)
    Current.user = @current_user
    AdminAuditEvent.record!(
      actor: @current_user,
      action: "admin_mcp.authenticate",
      resource: credential_record,
      metadata: @admin_credential.audit_metadata.merge(request_id: request.request_id)
    )
  end

  def extract_admin_bearer_token
    BearerTokenExtractor.extract(request.headers["Authorization"])
  end

  def valid_admin_credential?(credential_record, raw_token)
    if credential_record.is_a?(ApiKey)
      credential_record.admin_compliant?
    else
      OauthAccessToken.hardened_access_token?(raw_token) &&
        credential_record.resource == admin_oauth_resource.uri && credential_record.scopes == [ "admin" ]
    end
  end

  def admin_oauth_resource
    @admin_oauth_resource ||= Oauth::ResourceRegistry.new(base_url: request.base_url).admin_mcp
  end

  def admin_resource_metadata_url
    base_url = ENV.fetch("API_BASE_URL") { request.base_url }.delete_suffix("/")
    "#{base_url}#{admin_oauth_resource.metadata_path}"
  end

  def render_admin_unauthorized(message, invalid_token: false)
    challenge = %(Bearer resource_metadata="#{admin_resource_metadata_url}", scope="admin")
    challenge += %(, error="invalid_token") if invalid_token
    response.headers["WWW-Authenticate"] = challenge
    render json: { error: message }, status: :unauthorized
  end

  def audit_authorization_denied(credential_record)
    credential = Admin::Credential.new(credential_record)
    AdminAuditEvent.record!(
      actor: @current_user,
      action: "admin_mcp.authorization_denied",
      resource: credential_record,
      metadata: credential.audit_metadata.merge(request_id: request.request_id)
    )
  end

  def process_request(message)
    unless valid_message?(message)
      candidate_id = message.is_a?(Hash) ? message["id"] : nil
      id = valid_request_id?(candidate_id) ? candidate_id : nil
      return jsonrpc_error(id, -32600, "Invalid Request")
    end

    notification = !message.key?("id")
    return nil if notification && message["method"] != "notifications/initialized"

    result = dispatch_method(message["method"], message["params"] || {})
    notification ? nil : jsonrpc_response(message["id"], result)
  rescue Admin::Mcp::UnknownToolError => e
    notification ? nil : jsonrpc_error(message["id"], -32601, e.message)
  rescue ActiveRecord::RecordNotFound
    notification ? nil : jsonrpc_response(message["id"], tool_error("The requested record was not found"))
  rescue ActiveRecord::RecordInvalid => e
    notification ? nil : jsonrpc_response(message["id"], tool_error(e.record.errors.full_messages.join(", ")))
  rescue ActiveRecord::DeleteRestrictionError => e
    notification ? nil : jsonrpc_response(message["id"], tool_error(e.message))
  rescue ArgumentError, KeyError => e
    notification ? nil : jsonrpc_response(message["id"], tool_error(e.message))
  rescue StandardError => e
    Rails.logger.error("Admin MCP error request_id=#{request.request_id} class=#{e.class}")
    notification ? nil : jsonrpc_error(message["id"], -32603, "Internal error")
  end

  def dispatch_method(method, params)
    case method
    when "initialize"
      initialize_result(params)
    when "notifications/initialized"
      nil
    when "ping"
      { pong: true }
    when "tools/list"
      { tools: tool_registry.definitions }
    when "tools/call"
      call_tool(params)
    else
      raise Admin::Mcp::UnknownToolError, "Method not found: #{method}"
    end
  end

  def initialize_result(params)
    requested = params["protocolVersion"]
    version = SUPPORTED_PROTOCOL_VERSIONS.include?(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS.first
    {
      protocolVersion: version,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "listygifty-admin-mcp", version: "1.0.0" }
    }
  end

  def call_tool(params)
    result = tool_registry.call(params.fetch("name"), params["arguments"] || {})
    { content: [ { type: "text", text: result.to_json } ] }
  end

  def tool_registry
    @tool_registry ||= Admin::Mcp::ToolRegistry.new(actor: @current_user, credential: @admin_credential, request_id: request.request_id)
  end

  def tool_error(message)
    { content: [ { type: "text", text: { error: message }.to_json } ], isError: true }
  end

  def jsonrpc_response(id, result)
    { jsonrpc: "2.0", id: id, result: result }
  end

  def jsonrpc_error(id, code, message)
    { jsonrpc: "2.0", id: id, error: { code: code, message: message } }
  end

  def valid_message?(message)
    return false unless message.is_a?(Hash)
    return false unless message["jsonrpc"] == "2.0"
    return false unless message["method"].is_a?(String) && message["method"].present? && message["method"].length <= MAX_METHOD_LENGTH
    return false unless !message.key?("params") || message["params"].is_a?(Hash)
    return false unless !message.key?("id") || valid_request_id?(message["id"])

    true
  end

  def valid_request_id?(id)
    id.nil? || id.is_a?(String) || id.is_a?(Integer)
  end

  def bounded_request_body
    if request.content_length.to_i > MAX_REQUEST_BYTES
      render json: { error: "Admin MCP request is too large" }, status: :content_too_large
      return nil
    end

    body = request.body.read(MAX_REQUEST_BYTES + 1)
    if body.bytesize > MAX_REQUEST_BYTES
      render json: { error: "Admin MCP request is too large" }, status: :content_too_large
      return nil
    end
    body
  end

  def ensure_admin_mcp_enabled!
    enabled = ENV.fetch("ADMIN_MCP_ENABLED", Rails.env.production? ? "false" : "true") == "true"
    head :not_found unless enabled
  end

  def validate_content_type!
    return unless request.post?

    render json: { error: "Content-Type must be application/json" }, status: :unsupported_media_type unless request.media_type == "application/json"
  end

  def validate_origin!
    origin = request.headers["Origin"]
    return if origin.blank?

    allowed = ENV.fetch("ADMIN_MCP_ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:blank?)
    render json: { error: "Origin is not allowed for the admin MCP" }, status: :forbidden unless allowed.include?(origin)
  end

  def set_security_headers
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
  end
end
