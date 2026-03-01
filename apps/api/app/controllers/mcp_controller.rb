# MCP (Model Context Protocol) HTTP endpoint
# Implements Streamable HTTP transport for remote MCP connections
class McpController < ApplicationController
  include ActionController::Live
  include OauthTokenAuthenticatable

  skip_before_action :authenticate!
  before_action :authenticate_oauth_or_api_key!

  # POST /mcp
  # Main MCP endpoint - handles JSON-RPC messages
  def handle
    # Parse JSON-RPC request
    begin
      body = JSON.parse(request.body.read)
    rescue JSON::ParserError
      return render_jsonrpc_error(nil, -32700, "Parse error")
    end

    # Handle batch requests
    if body.is_a?(Array)
      responses = body.map { |req| process_jsonrpc_request(req) }.compact
      if responses.any?
        render json: responses
      else
        head :no_content
      end
    else
      response = process_jsonrpc_request(body)
      if response
        render json: response
      else
        head :no_content
      end
    end
  end

  # GET /mcp (SSE transport - for legacy/fallback support)
  def sse_connect
    response.headers["Content-Type"] = "text/event-stream"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "keep-alive"
    response.headers["X-Accel-Buffering"] = "no"

    sse = SSE.new(response.stream, retry: 3000)

    # Send endpoint information
    sse.write({ endpoint: "#{request.base_url}/mcp/messages" }, event: "endpoint")

    # Keep connection alive with heartbeat
    loop do
      sse.write({ time: Time.current.iso8601 }, event: "heartbeat")
      sleep 30
    end
  rescue ActionController::Live::ClientDisconnected
    # Client disconnected, clean up
  ensure
    sse&.close
  end

  # POST /mcp/messages (SSE transport - message endpoint)
  def sse_message
    begin
      body = JSON.parse(request.body.read)
    rescue JSON::ParserError
      return render_jsonrpc_error(nil, -32700, "Parse error")
    end

    response = process_jsonrpc_request(body)
    if response
      render json: response
    else
      head :no_content
    end
  end

  private

  def authenticate_oauth_or_api_key!
    # Try OAuth token first
    if authenticate_with_oauth_token
      return true
    end

    # Fall back to API key
    if authenticate_with_api_key
      return true
    end

    # Return 401 with WWW-Authenticate header per RFC 9728
    response.headers["WWW-Authenticate"] = %(Bearer resource_metadata="#{resource_metadata_url}", scope="read write")
    render json: { error: "unauthorized", error_description: "Valid OAuth token or API key required" }, status: :unauthorized
    false
  end

  def authenticate_with_oauth_token
    auth_header = request.headers["Authorization"]
    return false unless auth_header&.start_with?("Bearer ")

    token = auth_header.split(" ").last
    return false if token.start_with?("ng_") # This is an API key, not OAuth

    oauth_token = OauthAccessToken.find_by_token(token)
    return false unless oauth_token

    # Validate audience (resource parameter)
    if oauth_token.resource.present?
      mcp_uri = ENV.fetch("MCP_SERVER_URI") { "#{request.base_url}/mcp" }
      unless oauth_token.resource == mcp_uri
        return false
      end
    end

    oauth_token.touch_last_used!
    @current_user = oauth_token.user
    @current_oauth_token = oauth_token
    Current.user = @current_user
    true
  end

  def authenticate_with_api_key
    # Check Authorization header or X-API-Key header
    auth_header = request.headers["Authorization"]
    api_key_header = request.headers["X-API-Key"]

    raw_key = if auth_header&.start_with?("Bearer ng_")
      auth_header.split(" ").last
    elsif api_key_header&.start_with?("ng_")
      api_key_header
    end

    return false unless raw_key

    api_key = ApiKey.find_by_raw_key(raw_key)
    return false unless api_key

    @current_user = api_key.user
    @current_api_key = api_key
    Current.user = @current_user
    true
  end

  def process_jsonrpc_request(req)
    unless req.is_a?(Hash) && req["jsonrpc"] == "2.0"
      return jsonrpc_error(req&.dig("id"), -32600, "Invalid Request")
    end

    method = req["method"]
    params = req["params"] || {}
    id = req["id"]

    # Handle notifications (no id means no response expected)
    is_notification = id.nil?

    begin
      result = dispatch_method(method, params)
      is_notification ? nil : jsonrpc_response(id, result)
    rescue McpError => e
      is_notification ? nil : jsonrpc_error(id, e.code, e.message, e.data)
    rescue => e
      Rails.logger.error("MCP error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
      is_notification ? nil : jsonrpc_error(id, -32603, "Internal error")
    end
  end

  def dispatch_method(method, params)
    case method
    when "initialize"
      handle_initialize(params)
    when "notifications/initialized"
      nil # Notification, no response
    when "tools/list"
      handle_list_tools(params)
    when "tools/call"
      handle_call_tool(params)
    when "resources/list"
      handle_list_resources(params)
    when "resources/read"
      handle_read_resource(params)
    when "ping"
      { pong: true }
    else
      raise McpError.new(-32601, "Method not found: #{method}")
    end
  end

  def handle_initialize(params)
    {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo: {
        name: "listygifty-mcp",
        version: "1.0.0"
      }
    }
  end

  def handle_list_tools(_params)
    { tools: mcp_tools }
  end

  def handle_call_tool(params)
    tool_name = params["name"]
    tool_args = params["arguments"] || {}

    tool_handler = tool_handlers[tool_name]
    raise McpError.new(-32601, "Unknown tool: #{tool_name}") unless tool_handler

    # Check scope permissions
    required_scope = tool_handler[:scope] || "read"
    unless can_access_scope?(required_scope)
      raise McpError.new(-32000, "Insufficient permissions. Required scope: #{required_scope}")
    end

    result = tool_handler[:handler].call(tool_args)
    { content: [ { type: "text", text: result.to_json } ] }
  end

  def handle_list_resources(_params)
    { resources: mcp_resources }
  end

  def handle_read_resource(params)
    uri = params["uri"]
    resource = resource_handlers[uri]
    raise McpError.new(-32602, "Unknown resource: #{uri}") unless resource

    result = resource[:handler].call
    { contents: [ { uri: uri, mimeType: "application/json", text: result.to_json } ] }
  end

  def can_access_scope?(scope)
    if @current_oauth_token
      @current_oauth_token.can?(scope)
    elsif @current_api_key
      @current_api_key.can?(scope)
    else
      false
    end
  end

  def jsonrpc_response(id, result)
    { jsonrpc: "2.0", id: id, result: result }
  end

  def jsonrpc_error(id, code, message, data = nil)
    error = { code: code, message: message }
    error[:data] = data if data
    { jsonrpc: "2.0", id: id, error: error }
  end

  def render_jsonrpc_error(id, code, message)
    render json: jsonrpc_error(id, code, message)
  end

  def resource_metadata_url
    "#{request.base_url}/.well-known/oauth-protected-resource"
  end

  # MCP Tools and Resources definitions
  def mcp_tools
    tool_handlers.map do |name, config|
      {
        name: name,
        description: config[:description],
        inputSchema: config[:schema]
      }
    end
  end

  def mcp_resources
    resource_handlers.map do |uri, config|
      {
        uri: uri,
        name: config[:name],
        description: config[:description],
        mimeType: "application/json"
      }
    end
  end

  def tool_handlers
    @tool_handlers ||= build_tool_handlers
  end

  def resource_handlers
    @resource_handlers ||= build_resource_handlers
  end

  def build_tool_handlers
    {
      # Workspace tools
      "list_workspaces" => {
        description: "List all workspaces the user has access to",
        scope: "read",
        schema: { type: "object", properties: {} },
        handler: ->(_args) { WorkspaceMembership.where(user: @current_user).includes(:workspace).map { |m| workspace_to_json(m.workspace, m.role) } }
      },
      "get_workspace" => {
        description: "Get details of a specific workspace",
        scope: "read",
        schema: { type: "object", properties: { workspace_id: { type: "integer" } }, required: [ "workspace_id" ] },
        handler: ->(args) { workspace_to_json(find_workspace(args["workspace_id"])) }
      },

      # Holiday tools
      "list_holidays" => {
        description: "List all holidays in a workspace",
        scope: "read",
        schema: { type: "object", properties: { workspace_id: { type: "integer" } }, required: [ "workspace_id" ] },
        handler: ->(args) { find_workspace(args["workspace_id"]).holidays.map { |h| holiday_to_json(h) } }
      },
      "create_holiday" => {
        description: "Create a new holiday",
        scope: "write",
        schema: {
          type: "object",
          properties: {
            workspace_id: { type: "integer" },
            name: { type: "string" },
            date: { type: "string", format: "date" },
            icon: { type: "string" }
          },
          required: [ "workspace_id", "name" ]
        },
        handler: ->(args) {
          workspace = find_workspace(args["workspace_id"])
          holiday = workspace.holidays.create!(
            name: args["name"],
            date: args["date"],
            icon: args["icon"]
          )
          HolidayUser.create!(holiday: holiday, user: @current_user, role: "owner")
          holiday_to_json(holiday)
        }
      },

      # Gift tools
      "list_gifts" => {
        description: "List all gifts for a holiday",
        scope: "read",
        schema: { type: "object", properties: { holiday_id: { type: "integer" } }, required: [ "holiday_id" ] },
        handler: ->(args) {
          holiday = find_holiday(args["holiday_id"])
          holiday.gifts.includes(:gift_recipients, :gift_givers, :gift_status).map { |g| gift_to_json(g) }
        }
      },
      "create_gift" => {
        description: "Create a new gift",
        scope: "write",
        schema: {
          type: "object",
          properties: {
            holiday_id: { type: "integer" },
            name: { type: "string" },
            description: { type: "string" },
            link: { type: "string" },
            cost: { type: "number" },
            recipient_ids: { type: "array", items: { type: "integer" } }
          },
          required: [ "holiday_id", "name" ]
        },
        handler: ->(args) {
          holiday = find_holiday(args["holiday_id"])
          gift = holiday.gifts.create!(
            name: args["name"],
            description: args["description"],
            link: args["link"],
            cost: args["cost"],
            gift_status: GiftStatus.first,
            created_by_user_id: @current_user.id
          )
          (args["recipient_ids"] || []).each do |pid|
            gift.gift_recipients.create!(person_id: pid)
          end
          gift_to_json(gift)
        }
      },

      # People tools
      "list_people" => {
        description: "List all people in a workspace",
        scope: "read",
        schema: { type: "object", properties: { workspace_id: { type: "integer" } }, required: [ "workspace_id" ] },
        handler: ->(args) { find_workspace(args["workspace_id"]).people.map { |p| person_to_json(p) } }
      },
      "create_person" => {
        description: "Create a new person/contact",
        scope: "write",
        schema: {
          type: "object",
          properties: {
            workspace_id: { type: "integer" },
            name: { type: "string" },
            email: { type: "string" },
            relationship: { type: "string" },
            notes: { type: "string" }
          },
          required: [ "workspace_id", "name" ]
        },
        handler: ->(args) {
          workspace = find_workspace(args["workspace_id"])
          person = workspace.people.create!(
            name: args["name"],
            email: args["email"],
            relationship: args["relationship"],
            notes: args["notes"],
            user: @current_user
          )
          person_to_json(person)
        }
      },

      # Wishlist tools
      "list_wishlists" => {
        description: "List all wishlists in a workspace",
        scope: "read",
        schema: { type: "object", properties: { workspace_id: { type: "integer" } }, required: [ "workspace_id" ] },
        handler: ->(args) { find_workspace(args["workspace_id"]).wishlists.map { |w| wishlist_to_json(w) } }
      }
    }
  end

  def build_resource_handlers
    {
      "listygifty://dashboard" => {
        name: "Dashboard Overview",
        description: "Get an overview of the user's gift management dashboard",
        handler: -> {
          workspaces = WorkspaceMembership.where(user: @current_user).includes(:workspace).map(&:workspace)
          upcoming_holidays = workspaces.flat_map { |w| w.holidays.where("date >= ?", Date.current).order(:date).limit(5) }
          {
            workspaces: workspaces.map { |w| { id: w.id, name: w.name } },
            upcoming_holidays: upcoming_holidays.map { |h| { id: h.id, name: h.name, date: h.date } }
          }
        }
      },
      "listygifty://billing" => {
        name: "Billing Status",
        description: "Get the user's current subscription and billing status",
        handler: -> {
          {
            plan: @current_user.subscription_plan,
            expires_at: @current_user.subscription_expires_at,
            is_premium: @current_user.subscription_plan != "free"
          }
        }
      }
    }
  end

  # Helper methods
  def find_workspace(id)
    membership = WorkspaceMembership.find_by!(workspace_id: id, user: @current_user)
    membership.workspace
  end

  def find_holiday(id)
    Holiday.joins(:holiday_users).where(holiday_users: { user_id: @current_user.id }).find(id)
  end

  def workspace_to_json(workspace, role = nil)
    { id: workspace.id, name: workspace.name, type: workspace.workspace_type, role: role }
  end

  def holiday_to_json(holiday)
    { id: holiday.id, name: holiday.name, date: holiday.date, icon: holiday.icon }
  end

  def gift_to_json(gift)
    {
      id: gift.id,
      name: gift.name,
      description: gift.description,
      link: gift.link,
      cost: gift.cost&.to_f,
      status: gift.gift_status&.name,
      recipients: gift.gift_recipients.includes(:person).map { |gr| { id: gr.person.id, name: gr.person.name } }
    }
  end

  def person_to_json(person)
    { id: person.id, name: person.name, email: person.email, relationship: person.relationship }
  end

  def wishlist_to_json(wishlist)
    { id: wishlist.id, name: wishlist.name, description: wishlist.description, item_count: wishlist.wishlist_items.count }
  end
end

# Custom MCP error class
class McpError < StandardError
  attr_reader :code, :data

  def initialize(code, message, data = nil)
    @code = code
    @data = data
    super(message)
  end
end
