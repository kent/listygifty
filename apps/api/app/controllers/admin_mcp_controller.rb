class AdminMcpController < ApplicationController
  SUPPORTED_PROTOCOL_VERSIONS = %w[2025-06-18 2025-03-26 2024-11-05].freeze
  MAX_REQUEST_BYTES = 256.kilobytes
  MAX_BATCH_SIZE = 20
  MAX_JSON_DEPTH = 32
  MAX_METHOD_LENGTH = 100

  skip_before_action :authenticate!
  before_action :set_security_headers
  before_action :ensure_admin_mcp_enabled!
  before_action :validate_content_type!
  before_action :validate_origin!
  before_action :authenticate_admin_api_key!
  after_action :set_security_headers

  def handle
    raw_body = bounded_request_body
    return if performed?

    body = JSON.parse(raw_body, max_nesting: MAX_JSON_DEPTH)
    if body.is_a?(Array)
      return render json: jsonrpc_error(nil, -32600, "Invalid Request") unless body.length.between?(1, MAX_BATCH_SIZE)

      responses = body.filter_map { |item| process_request(item) }
      responses.any? ? render(json: responses) : head(:no_content)
    else
      response = process_request(body)
      response ? render(json: response) : head(:no_content)
    end
  rescue JSON::ParserError, JSON::NestingError
    render json: jsonrpc_error(nil, -32700, "Parse error")
  end

  private

  def authenticate_admin_api_key!
    raw_key = extract_admin_api_key
    unless raw_key
      response.headers["WWW-Authenticate"] = %(Bearer realm="listygifty-admin-mcp")
      return render json: { error: "Admin API key required" }, status: :unauthorized
    end

    @admin_api_key = ApiKey.find_by_raw_key(raw_key)
    unless @admin_api_key
      response.headers["WWW-Authenticate"] = %(Bearer realm="listygifty-admin-mcp")
      return render json: { error: "Invalid or expired admin API key" }, status: :unauthorized
    end

    @current_user = @admin_api_key.user
    unless @admin_api_key.admin_compliant? && Admin::Authorization.allowed?(@current_user)
      AdminAuditEvent.record!(
        actor: @current_user,
        action: "admin_mcp.authorization_denied",
        resource: @admin_api_key,
        metadata: { request_id: request.request_id }
      )
      return render json: { error: "This API key is not authorized for Listy Gifty administration" }, status: :forbidden
    end

    Current.user = @current_user
    AdminAuditEvent.record!(
      actor: @current_user,
      action: "admin_mcp.authenticate",
      resource: @admin_api_key,
      metadata: { request_id: request.request_id }
    )
  end

  def extract_admin_api_key
    authorization = request.headers["Authorization"]
    authorization.delete_prefix("Bearer ") if authorization&.match?(/\ABearer ng_[A-Za-z0-9_-]{43}\z/)
  end

  def process_request(message)
    unless valid_message?(message)
      return jsonrpc_error(message.is_a?(Hash) ? message["id"] : nil, -32600, "Invalid Request")
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
    @tool_registry ||= Admin::Mcp::ToolRegistry.new(actor: @current_user, api_key: @admin_api_key, request_id: request.request_id)
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
