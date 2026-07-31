# MCP (Model Context Protocol) HTTP endpoint
# Implements Streamable HTTP transport for remote MCP connections
class McpController < ApplicationController
  include ActionController::Live
  include OauthTokenAuthenticatable

  SUPPORTED_PROTOCOL_VERSIONS = %w[2025-06-18 2025-03-26 2024-11-05].freeze

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
    requested_version = params["protocolVersion"]
    protocol_version = SUPPORTED_PROTOCOL_VERSIONS.include?(requested_version) ? requested_version : SUPPORTED_PROTOCOL_VERSIONS.first

    {
      protocolVersion: protocol_version,
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo: {
        name: "listygifty-mcp",
        version: "1.1.0"
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
  rescue ActiveRecord::RecordInvalid => e
    tool_error(e.record.errors.full_messages.join(", "))
  rescue ActiveRecord::RecordNotFound
    tool_error("The requested record was not found or is not accessible")
  rescue ArgumentError => e
    tool_error(e.message)
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
    handlers = {
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
      "get_holiday" => {
        description: "Get a holiday or occasion",
        scope: "read",
        schema: tool_schema({ holiday_id: integer_property("Holiday ID") }, [ "holiday_id" ]),
        handler: ->(args) { HolidayBlueprint.render_as_hash(find_holiday(args["holiday_id"]), current_user: @current_user) }
      },
      "update_holiday" => {
        description: "Update a holiday or occasion",
        scope: "write",
        schema: tool_schema({
          holiday_id: integer_property("Holiday ID"),
          name: string_property,
          date: string_property("Date in YYYY-MM-DD format"),
          icon: string_property,
          completed: boolean_property,
          archived: boolean_property
        }, [ "holiday_id" ]),
        handler: ->(args) {
          holiday = find_holiday(args["holiday_id"])
          holiday.update!(slice_args(args, %w[name date icon completed archived]))
          HolidayBlueprint.render_as_hash(holiday, current_user: @current_user)
        }
      },
      "delete_holiday" => {
        description: "Delete a holiday owned by the current user",
        scope: "write",
        schema: tool_schema({ holiday_id: integer_property("Holiday ID") }, [ "holiday_id" ]),
        handler: ->(args) {
          holiday = find_holiday(args["holiday_id"])
          raise ActiveRecord::RecordNotFound unless holiday.owner?(@current_user)
          holiday.destroy!
          { deleted: true }
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
            gift_status_id: { type: "integer" },
            recipient_ids: { type: "array", items: { type: "integer" } },
            giver_ids: { type: "array", items: { type: "integer" } }
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
            gift_status: args["gift_status_id"] ? GiftStatus.find(args["gift_status_id"]) : GiftStatus.by_position.first,
            created_by_user_id: @current_user.id
          )
          gift.recipient_ids = args["recipient_ids"] || []
          gift.giver_ids = args["giver_ids"] || []
          GiftBlueprint.render_as_hash(gift.reload, current_user: @current_user)
        }
      },
      "get_gift" => {
        description: "Get a gift and its recipients, givers, and status",
        scope: "read",
        schema: tool_schema({ gift_id: integer_property("Gift ID") }, [ "gift_id" ]),
        handler: ->(args) { GiftBlueprint.render_as_hash(find_gift(args["gift_id"]), current_user: @current_user) }
      },
      "update_gift" => {
        description: "Update an accessible gift, including recipients and givers",
        scope: "write",
        schema: gift_update_schema,
        handler: ->(args) { update_gift_from_mcp(args) }
      },
      "delete_gift" => {
        description: "Delete an accessible gift",
        scope: "write",
        schema: tool_schema({ gift_id: integer_property("Gift ID") }, [ "gift_id" ]),
        handler: ->(args) {
          find_gift(args["gift_id"]).destroy!
          { deleted: true }
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
      "get_person" => {
        description: "Get an accessible person/contact",
        scope: "read",
        schema: tool_schema({ person_id: integer_property("Person ID") }, [ "person_id" ]),
        handler: ->(args) { PersonBlueprint.render_as_hash(find_person(args["person_id"]), current_user: @current_user, current_workspace: find_person(args["person_id"]).workspace) }
      },
      "update_person" => {
        description: "Update an accessible person/contact",
        scope: "write",
        schema: person_update_schema,
        handler: ->(args) {
          person = find_person(args["person_id"])
          person.update!(slice_args(args, person_attributes))
          PersonBlueprint.render_as_hash(person, current_user: @current_user, current_workspace: person.workspace)
        }
      },
      "delete_person" => {
        description: "Delete a contact owned by the current user when no gifts are attached",
        scope: "write",
        schema: tool_schema({ person_id: integer_property("Person ID") }, [ "person_id" ]),
        handler: ->(args) {
          person = find_person(args["person_id"])
          raise ActiveRecord::RecordNotFound unless person.user_id == @current_user.id
          raise ArgumentError, "Cannot delete a person who has gifts attached" if person.gifts_received.exists? || person.gifts_given.exists?
          person.destroy!
          { deleted: true }
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

    handlers.merge(wishlist_tool_handlers).merge(exchange_tool_handlers)
  end

  def wishlist_tool_handlers
    {
      "get_wishlist" => {
        description: "Get an accessible wishlist and all active items",
        scope: "read",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) { serialize_wishlist(find_wishlist(args["wishlist_id"]), with_items: true) }
      },
      "create_wishlist" => {
        description: "Create a wishlist in a workspace",
        scope: "write",
        schema: tool_schema({
          workspace_id: integer_property("Workspace ID"),
          name: string_property("Wishlist name"),
          description: string_property("Description"),
          visibility: enum_property(%w[private workspace shared]),
          anti_spoiler_enabled: boolean_property,
          target_date: string_property("Target date in YYYY-MM-DD format")
        }, %w[workspace_id name]),
        handler: ->(args) {
          workspace = find_workspace(args["workspace_id"])
          wishlist = workspace.wishlists.create!(
            user: @current_user,
            **slice_args(args, %w[name description visibility anti_spoiler_enabled target_date])
          )
          serialize_wishlist(wishlist)
        }
      },
      "update_wishlist" => {
        description: "Update a wishlist owned by the current user",
        scope: "write",
        schema: tool_schema({
          wishlist_id: integer_property("Wishlist ID"),
          name: string_property,
          description: string_property,
          visibility: enum_property(%w[private workspace shared]),
          anti_spoiler_enabled: boolean_property,
          target_date: string_property("Target date in YYYY-MM-DD format")
        }, [ "wishlist_id" ]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          wishlist.update!(slice_args(args, %w[name description visibility anti_spoiler_enabled target_date]))
          serialize_wishlist(wishlist)
        }
      },
      "delete_wishlist" => {
        description: "Permanently delete a wishlist owned by the current user",
        scope: "write",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) {
          find_owned_wishlist(args["wishlist_id"]).destroy!
          { deleted: true }
        }
      },
      "share_wishlist" => {
        description: "Create or regenerate a public share link for an owned wishlist",
        scope: "write",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          wishlist.regenerate_share_link!
          serialize_wishlist(wishlist)
        }
      },
      "revoke_wishlist_share" => {
        description: "Revoke an owned wishlist's share link and make it private",
        scope: "write",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          wishlist.revoke_share_link!
          serialize_wishlist(wishlist)
        }
      },
      "reveal_wishlist_claims" => {
        description: "Reveal all hidden claims on an owned wishlist",
        scope: "write",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          { revealed_count: wishlist.claims.unrevealed.update_all(revealed_at: Time.current) }
        }
      },
      "list_wishlist_items" => {
        description: "List active items on an accessible wishlist",
        scope: "read",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) { serialize_wishlist_items(find_wishlist(args["wishlist_id"]).wishlist_items.active.by_priority) }
      },
      "create_wishlist_item" => {
        description: "Add an item to an owned wishlist",
        scope: "write",
        schema: wishlist_item_schema(required: %w[wishlist_id name]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          item = wishlist.wishlist_items.create!(slice_args(args, wishlist_item_attributes))
          serialize_wishlist_item(item)
        }
      },
      "update_wishlist_item" => {
        description: "Update an item on an owned wishlist",
        scope: "write",
        schema: wishlist_item_schema(required: %w[wishlist_id item_id], include_item_id: true),
        handler: ->(args) {
          item = find_owned_wishlist(args["wishlist_id"]).wishlist_items.find(args["item_id"])
          item.update!(slice_args(args, wishlist_item_attributes))
          serialize_wishlist_item(item)
        }
      },
      "delete_wishlist_item" => {
        description: "Delete an item from an owned wishlist",
        scope: "write",
        schema: tool_schema({
          wishlist_id: integer_property("Wishlist ID"),
          item_id: integer_property("Wishlist item ID")
        }, %w[wishlist_id item_id]),
        handler: ->(args) {
          find_owned_wishlist(args["wishlist_id"]).wishlist_items.find(args["item_id"]).destroy!
          { deleted: true }
        }
      },
      "claim_wishlist_item" => {
        description: "Reserve or purchase an available item on another user's accessible wishlist",
        scope: "write",
        schema: tool_schema({
          wishlist_id: integer_property("Wishlist ID"),
          item_id: integer_property("Wishlist item ID"),
          quantity: integer_property("Quantity to claim"),
          purchased: boolean_property
        }, %w[wishlist_id item_id]),
        handler: ->(args) { claim_wishlist_item(args) }
      },
      "unclaim_wishlist_item" => {
        description: "Remove the current user's claim from a wishlist item",
        scope: "write",
        schema: tool_schema({
          wishlist_id: integer_property("Wishlist ID"),
          item_id: integer_property("Wishlist item ID")
        }, %w[wishlist_id item_id]),
        handler: ->(args) {
          item = find_wishlist(args["wishlist_id"]).wishlist_items.find(args["item_id"])
          item.claims.by_user(@current_user).first!.destroy!
          { unclaimed: true }
        }
      },
      "mark_wishlist_item_purchased" => {
        description: "Mark the current user's claim as purchased",
        scope: "write",
        schema: tool_schema({
          wishlist_id: integer_property("Wishlist ID"),
          item_id: integer_property("Wishlist item ID")
        }, %w[wishlist_id item_id]),
        handler: ->(args) {
          item = find_wishlist(args["wishlist_id"]).wishlist_items.find(args["item_id"])
          claim = item.claims.by_user(@current_user).first!
          claim.mark_purchased!
          WishlistItemClaimBlueprint.render_as_hash(claim)
        }
      }
    }
  end

  def exchange_tool_handlers
    {
      "list_gift_exchanges" => {
        description: "List gift exchanges the user owns or participates in, optionally filtered by workspace",
        scope: "read",
        schema: tool_schema({ workspace_id: integer_property("Optional workspace ID") }),
        handler: ->(args) {
          exchanges = accessible_exchanges
          exchanges = exchanges.where(workspace_id: find_workspace(args["workspace_id"]).id) if args["workspace_id"]
          serialize_exchanges(exchanges.order(created_at: :desc))
        }
      },
      "get_gift_exchange" => {
        description: "Get a gift exchange, including organizer details or the current user's match as permitted. Owners also receive share_url, a public link anyone can use to sign up and join while the exchange is still open.",
        scope: "read",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) { serialize_exchange(find_exchange(args["exchange_id"])) }
      },
      "create_gift_exchange" => {
        description: "Create a gift exchange, optionally adding the current user as an accepted participant. The response includes share_url, a public join link the organizer can drop into a group chat instead of inviting people by email.",
        scope: "write",
        schema: exchange_schema(required: %w[workspace_id name], include_workspace: true, include_creator: true),
        handler: ->(args) { create_exchange(args) }
      },
      "update_gift_exchange" => {
        description: "Update an owned gift exchange",
        scope: "write",
        schema: exchange_schema(required: [ "exchange_id" ], include_exchange_id: true),
        handler: ->(args) {
          exchange = ensure_exchange_editable!(find_owned_exchange(args["exchange_id"]))
          exchange.update!(slice_args(args, exchange_attributes))
          serialize_exchange(exchange.reload)
        }
      },
      "delete_gift_exchange" => {
        description: "Permanently delete an owned gift exchange. Participants of inviting or active exchanges are emailed a cancellation notice; matches, invites, and exchange wishlists are destroyed.",
        scope: "write",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) {
          ExchangeDeletionService.delete!(find_owned_exchange(args["exchange_id"]))
          { deleted: true }
        }
      },
      "list_exchange_participants" => {
        description: "List participants in an accessible gift exchange; invite tokens are only returned to the organizer",
        scope: "read",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) {
          exchange = find_exchange(args["exchange_id"])
          if exchange.owner?(@current_user)
            ExchangeParticipantBlueprint.render_as_hash(exchange.exchange_participants, view: :organizer)
          else
            ExchangeParticipantBlueprint.render_roster_as_hash(exchange.exchange_participants)
          end
        }
      },
      "accept_exchange_invite" => {
        description: "Accept a gift exchange invitation using its private invite token",
        scope: "write",
        schema: tool_schema({ invite_token: string_property("Private invitation token") }, [ "invite_token" ]),
        handler: ->(args) {
          participant = ExchangeParticipant.find_by!(invite_token: args["invite_token"])
          participant.gift_exchange.with_lock do
            participant.reload
            raise ArgumentError, "This exchange has already been published" unless participant.gift_exchange.status == "inviting"
            raise ArgumentError, "This invite has already been accepted" if participant.status == "accepted"
            raise ArgumentError, "This invite has been declined" if participant.status == "declined"
            participant.accept!(@current_user)
          end
          serialize_exchange(participant.gift_exchange.reload)
        }
      },
      "decline_exchange_invite" => {
        description: "Decline a gift exchange invitation using its private invite token",
        scope: "write",
        schema: tool_schema({ invite_token: string_property("Private invitation token") }, [ "invite_token" ]),
        handler: ->(args) {
          participant = ExchangeParticipant.find_by!(invite_token: args["invite_token"])
          participant.gift_exchange.with_lock do
            participant.reload
            raise ArgumentError, "This exchange has already been published" unless participant.gift_exchange.status == "inviting"
            raise ArgumentError, "This invite has already been responded to" unless participant.status == "invited"
            participant.decline!
          end
          { declined: true, exchange_id: participant.gift_exchange_id }
        }
      },
      "add_exchange_participant" => {
        description: "Invite a participant to an owned gift exchange",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          name: string_property("Participant name"),
          email: string_property("Participant email")
        }, %w[exchange_id name email]),
        handler: ->(args) {
          exchange = ensure_exchange_editable!(find_owned_exchange(args["exchange_id"]))
          participant = exchange.exchange_participants.create!(name: args["name"], email: args["email"])
          exchange.update!(status: "inviting") if exchange.status == "draft"
          ExchangeMailer.invitation(participant).deliver_later
          ExchangeParticipantBlueprint.render_as_hash(participant, view: :organizer)
        }
      },
      "update_exchange_participant" => {
        description: "Update a participant in an owned gift exchange",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          participant_id: integer_property("Participant ID"),
          name: string_property,
          email: string_property
        }, %w[exchange_id participant_id]),
        handler: ->(args) {
          participant = ensure_exchange_editable!(
            find_owned_exchange(args["exchange_id"])
          ).exchange_participants.find(args["participant_id"])
          participant.update!(slice_args(args, %w[name email]))
          ExchangeParticipantBlueprint.render_as_hash(participant, view: :organizer)
        }
      },
      "remove_exchange_participant" => {
        description: "Remove a participant from an owned gift exchange",
        scope: "write",
        schema: participant_reference_schema,
        handler: ->(args) {
          ensure_exchange_editable!(
            find_owned_exchange(args["exchange_id"])
          ).exchange_participants.find(args["participant_id"]).destroy!
          { deleted: true }
        }
      },
      "resend_exchange_invite" => {
        description: "Resend an invitation to a participant who has not accepted",
        scope: "write",
        schema: participant_reference_schema,
        handler: ->(args) {
          participant = ensure_exchange_editable!(
            find_owned_exchange(args["exchange_id"])
          ).exchange_participants.find(args["participant_id"])
          raise ArgumentError, "Participant has already accepted" if participant.status == "accepted"
          ExchangeMailer.invitation(participant).deliver_later
          { sent: true, participant_id: participant.id }
        }
      },
      "list_exchange_exclusions" => {
        description: "List prohibited participant pairings for an owned exchange",
        scope: "read",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) {
          exchange = find_owned_exchange(args["exchange_id"])
          ExchangeExclusionBlueprint.render_as_hash(exchange.exchange_exclusions.includes(:participant_a, :participant_b))
        }
      },
      "add_exchange_exclusion" => {
        description: "Prevent two participants from being matched in either direction",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          participant_a_id: integer_property("First participant ID"),
          participant_b_id: integer_property("Second participant ID")
        }, %w[exchange_id participant_a_id participant_b_id]),
        handler: ->(args) {
          exchange = ensure_exchange_editable!(find_owned_exchange(args["exchange_id"]))
          exclusion = exchange.exchange_exclusions.create!(
            participant_a_id: args["participant_a_id"],
            participant_b_id: args["participant_b_id"]
          )
          ExchangeExclusionBlueprint.render_as_hash(exclusion)
        }
      },
      "remove_exchange_exclusion" => {
        description: "Remove a prohibited pairing from an owned exchange",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          exclusion_id: integer_property("Exclusion ID")
        }, %w[exchange_id exclusion_id]),
        handler: ->(args) {
          ensure_exchange_editable!(
            find_owned_exchange(args["exchange_id"])
          ).exchange_exclusions.find(args["exclusion_id"]).destroy!
          { deleted: true }
        }
      },
      "start_gift_exchange" => {
        description: "Compatibility alias for publish_gift_exchange",
        scope: "write",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) { start_exchange(args["exchange_id"]) }
      },
      "publish_gift_exchange" => {
        description: "Publish an owned exchange, close pending invites, assign accepted participants, and email them to sign in",
        scope: "write",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) { start_exchange(args["exchange_id"]) }
      },
      "redo_gift_exchange" => {
        description: "Redo an owned published exchange: reopen it for roster and exclusion changes, or immediately redraw different names and email everyone",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          mode: enum_property(%w[reopen redraw]).merge(
            description: "reopen clears matches and makes the exchange editable; redraw keeps the roster and rules and assigns different recipients now"
          )
        }, %w[exchange_id mode]),
        handler: ->(args) { redo_exchange(args["exchange_id"], args["mode"]) }
      },
      "get_my_exchange_match" => {
        description: "Get the current user's assigned recipient and their exchange wishlist",
        scope: "read",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) {
          exchange = find_exchange(args["exchange_id"])
          raise ArgumentError, "Matching has not started" unless %w[active completed].include?(exchange.status)
          participant = exchange.participant_for(@current_user)
          raise ActiveRecord::RecordNotFound unless participant&.matched_participant
          ExchangeParticipantBlueprint.render_as_hash(participant, view: :with_match)
        }
      },
      "list_exchange_wishlist_items" => {
        description: "List an exchange participant's wishlist when the current user is that participant or their assigned giver",
        scope: "read",
        schema: participant_reference_schema,
        handler: ->(args) {
          participant = find_exchange_participant_for_wishlist(args)
          ExchangeWishlistItemBlueprint.render_as_hash(participant.exchange_wishlist_items)
        }
      },
      "create_exchange_wishlist_item" => {
        description: "Add an item to the current user's own exchange wishlist",
        scope: "write",
        schema: exchange_wishlist_item_schema(required: %w[exchange_id participant_id name]),
        handler: ->(args) {
          participant = find_owned_exchange_participant(args)
          item = participant.exchange_wishlist_items.create!(slice_args(args, exchange_wishlist_item_attributes))
          ExchangeNotificationService.wishlist_item_added!(item)
          ExchangeWishlistItemBlueprint.render_as_hash(item)
        }
      },
      "update_exchange_wishlist_item" => {
        description: "Update an item on the current user's own exchange wishlist",
        scope: "write",
        schema: exchange_wishlist_item_schema(required: %w[exchange_id participant_id item_id], include_item_id: true),
        handler: ->(args) {
          participant = find_owned_exchange_participant(args)
          item = participant.exchange_wishlist_items.find(args["item_id"])
          item.update!(slice_args(args, exchange_wishlist_item_attributes))
          ExchangeWishlistItemBlueprint.render_as_hash(item)
        }
      },
      "delete_exchange_wishlist_item" => {
        description: "Delete an item from the current user's own exchange wishlist",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          participant_id: integer_property("Participant ID"),
          item_id: integer_property("Exchange wishlist item ID")
        }, %w[exchange_id participant_id item_id]),
        handler: ->(args) {
          find_owned_exchange_participant(args).exchange_wishlist_items.find(args["item_id"]).destroy!
          { deleted: true }
        }
      },
      "nudge_exchange_match" => {
        description: "Anonymously ask only the current user's assigned recipient to add more wishlist ideas",
        scope: "write",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) {
          participant = find_exchange(args["exchange_id"]).participant_for(@current_user)
          raise ActiveRecord::RecordNotFound unless participant
          notification = ExchangeNotificationService.nudge_match!(participant)
          ExchangeNotificationBlueprint.render_as_hash(notification)
        }
      },
      "list_exchange_notifications" => {
        description: "List the current participant's private exchange notifications",
        scope: "read",
        schema: tool_schema({ exchange_id: id_property("Gift exchange ID or slug") }, [ "exchange_id" ]),
        handler: ->(args) {
          exchange = find_exchange(args["exchange_id"])
          participant = exchange.participant_for(@current_user)
          raise ActiveRecord::RecordNotFound unless participant
          notifications = exchange.exchange_notifications
            .where(recipient_participant: participant)
            .recent_first
          ExchangeNotificationBlueprint.render_as_hash(notifications)
        }
      },
      "mark_exchange_notification_read" => {
        description: "Mark one of the current participant's exchange notifications as read",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          notification_id: integer_property("Notification ID")
        }, %w[exchange_id notification_id]),
        handler: ->(args) {
          exchange = find_exchange(args["exchange_id"])
          participant = exchange.participant_for(@current_user)
          raise ActiveRecord::RecordNotFound unless participant
          notification = exchange.exchange_notifications
            .where(recipient_participant: participant)
            .find(args["notification_id"])
          ExchangeNotificationBlueprint.render_as_hash(notification.mark_read!)
        }
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
  def tool_error(message)
    { content: [ { type: "text", text: { error: message }.to_json } ], isError: true }
  end

  def tool_schema(properties, required = [])
    schema = { type: "object", properties: properties }
    schema[:required] = required if required.any?
    schema
  end

  def string_property(description = nil)
    { type: "string" }.tap { |property| property[:description] = description if description }
  end

  def integer_property(description = nil)
    { type: "integer" }.tap { |property| property[:description] = description if description }
  end

  def id_property(description)
    { oneOf: [ { type: "integer" }, { type: "string" } ], description: description }
  end

  def boolean_property
    { type: "boolean" }
  end

  def enum_property(values)
    { type: "string", enum: values }
  end

  def slice_args(args, keys)
    args.slice(*keys).symbolize_keys
  end

  def wishlist_item_attributes
    %w[name notes url price_min price_max priority quantity image_url]
  end

  def gift_update_schema
    tool_schema({
      gift_id: integer_property("Gift ID"),
      name: string_property,
      description: string_property,
      link: string_property("Product URL"),
      cost: { type: "number" },
      holiday_id: integer_property("Holiday ID"),
      gift_status_id: integer_property("Gift status ID"),
      position: integer_property,
      recipient_ids: { type: "array", items: { type: "integer" } },
      giver_ids: { type: "array", items: { type: "integer" } }
    }, [ "gift_id" ])
  end

  def person_attributes
    %w[name email relationship age gender birthday milestone_label milestone_date notes default_shipping_address_id]
  end

  def person_update_schema
    properties = person_attributes.to_h { |attribute| [ attribute.to_sym, string_property ] }
    properties[:person_id] = integer_property("Person ID")
    properties[:age] = integer_property
    properties[:default_shipping_address_id] = integer_property
    tool_schema(properties, [ "person_id" ])
  end

  def wishlist_item_schema(required:, include_item_id: false)
    properties = {
      wishlist_id: integer_property("Wishlist ID"),
      name: string_property("Item name"),
      notes: string_property,
      url: string_property("Product URL"),
      price_min: { type: "number" },
      price_max: { type: "number" },
      priority: { oneOf: [ { type: "integer", enum: [ 0, 1, 2 ] }, enum_property(%w[normal high most_wanted]) ] },
      quantity: integer_property,
      image_url: string_property
    }
    properties[:item_id] = integer_property("Wishlist item ID") if include_item_id
    tool_schema(properties, required)
  end

  def exchange_attributes
    %w[name exchange_date budget_min budget_max]
  end

  def exchange_schema(required:, include_workspace: false, include_creator: false, include_exchange_id: false)
    properties = {
      name: string_property("Exchange name"),
      exchange_date: string_property("Exchange date in YYYY-MM-DD format"),
      budget_min: { type: "number" },
      budget_max: { type: "number" }
    }
    properties[:workspace_id] = integer_property("Workspace ID") if include_workspace
    properties[:include_creator] = boolean_property if include_creator
    properties[:exchange_id] = id_property("Gift exchange ID or slug") if include_exchange_id
    tool_schema(properties, required)
  end

  def participant_reference_schema
    tool_schema({
      exchange_id: id_property("Gift exchange ID or slug"),
      participant_id: integer_property("Participant ID")
    }, %w[exchange_id participant_id])
  end

  def exchange_wishlist_item_attributes
    %w[name description link price]
  end

  def exchange_wishlist_item_schema(required:, include_item_id: false)
    properties = {
      exchange_id: id_property("Gift exchange ID or slug"),
      participant_id: integer_property("Participant ID"),
      name: string_property("Item name"),
      description: string_property,
      link: string_property("Product URL"),
      price: { type: "number" }
    }
    properties[:item_id] = integer_property("Exchange wishlist item ID") if include_item_id
    tool_schema(properties, required)
  end

  def find_wishlist(id)
    workspace_ids = WorkspaceMembership.where(user: @current_user).select(:workspace_id)
    Wishlist.where(workspace_id: workspace_ids)
            .where("user_id = :user_id OR visibility = :visibility", user_id: @current_user.id, visibility: "workspace")
            .find(id)
  end

  def find_gift(id)
    Gift.where(holiday_id: @current_user.holiday_ids).find(id)
  end

  def update_gift_from_mcp(args)
    gift = find_gift(args["gift_id"])
    attributes = slice_args(args, %w[name description link cost holiday_id gift_status_id position])
    attributes[:recipient_ids] = args["recipient_ids"] if args.key?("recipient_ids")
    attributes[:giver_ids] = args["giver_ids"] if args.key?("giver_ids")
    gift.update!(attributes)
    GiftBlueprint.render_as_hash(gift.reload, current_user: @current_user)
  end

  def find_person(id)
    person = Person.find(id)
    raise ActiveRecord::RecordNotFound unless person.accessible_by?(@current_user)
    person
  end

  def find_owned_wishlist(id)
    @current_user.wishlists.find(id)
  end

  def serialize_wishlist(wishlist, with_items: false)
    options = { current_user: @current_user }
    options[:view] = :with_items if with_items
    WishlistBlueprint.render_as_hash(wishlist, **options)
  end

  def serialize_wishlist_item(item)
    WishlistItemBlueprint.render_as_hash(item, current_user: @current_user)
  end

  def serialize_wishlist_items(items)
    WishlistItemBlueprint.render_as_hash(items, current_user: @current_user)
  end

  def claim_wishlist_item(args)
    wishlist = find_wishlist(args["wishlist_id"])
    raise ArgumentError, "You cannot claim an item from your own wishlist" if wishlist.owner?(@current_user)

    item = wishlist.wishlist_items.find(args["item_id"])
    raise ArgumentError, "You have already claimed this item" if item.claims.by_user(@current_user).exists?

    purchased = ActiveModel::Type::Boolean.new.cast(args["purchased"])
    claim = item.with_lock do
      item.claims.create!(
        user: @current_user,
        quantity: args.fetch("quantity", 1),
        status: purchased ? "purchased" : "reserved",
        purchased_at: purchased ? Time.current : nil
      )
    end
    WishlistItemClaimBlueprint.render_as_hash(claim)
  end

  def accessible_exchanges
    GiftExchange.for_user(@current_user)
                .includes(exchange_participants: [ :matched_participant, :exchange_wishlist_items ])
  end

  def find_exchange(id)
    accessible_exchanges.find_by(slug: id.to_s) || accessible_exchanges.find(id)
  end

  def find_owned_exchange(id)
    exchanges = GiftExchange.owned_by(@current_user)
    exchanges.find_by(slug: id.to_s) || exchanges.find(id)
  end

  def serialize_exchanges(exchanges)
    GiftExchangeBlueprint.render_as_hash(exchanges, current_user: @current_user, view: :with_my_participation)
  end

  def serialize_exchange(exchange)
    view = exchange.owner?(@current_user) ? :with_participants : :with_my_participation
    GiftExchangeBlueprint.render_as_hash(exchange, current_user: @current_user, view: view)
  end

  def create_exchange(args)
    workspace = find_workspace(args["workspace_id"])
    exchange = workspace.gift_exchanges.new(
      user: @current_user,
      **slice_args(args, exchange_attributes)
    )

    GiftExchange.transaction do
      exchange.save!
      if !args.key?("include_creator") || ActiveModel::Type::Boolean.new.cast(args["include_creator"])
        exchange.exchange_participants.create!(
          user: @current_user,
          name: @current_user.safe_name,
          email: @current_user.email,
          status: "accepted"
        )
      end
    end
    serialize_exchange(exchange.reload)
  end

  def start_exchange(exchange_id)
    exchange = find_owned_exchange(exchange_id)
    raise ArgumentError, "Exchange is not ready to publish" unless exchange.can_publish?

    ExchangeDrawingService.new(exchange).publish!
    serialize_exchange(exchange.reload)
  rescue ExchangeMatchingService::MatchingError => e
    raise ArgumentError, e.message
  end

  def redo_exchange(exchange_id, mode)
    exchange = find_owned_exchange(exchange_id)
    service = ExchangeDrawingService.new(exchange)

    case mode
    when "reopen"
      service.reopen!
    when "redraw"
      service.redraw!
    else
      raise ArgumentError, "Mode must be reopen or redraw"
    end

    serialize_exchange(exchange.reload)
  rescue ExchangeDrawingService::RedoError, ExchangeMatchingService::MatchingError => e
    raise ArgumentError, e.message
  end

  def find_owned_exchange_participant(args)
    participant = find_exchange(args["exchange_id"]).exchange_participants.find(args["participant_id"])
    raise ActiveRecord::RecordNotFound unless participant.user_id == @current_user.id
    participant
  end

  def ensure_exchange_editable!(exchange)
    raise ArgumentError, "Published exchanges cannot be changed" unless exchange.editable?

    exchange
  end

  def find_exchange_participant_for_wishlist(args)
    exchange = find_exchange(args["exchange_id"])
    participant = exchange.exchange_participants.find(args["participant_id"])
    return participant if participant.user_id == @current_user.id

    current_participant = exchange.participant_for(@current_user)
    if %w[active completed].include?(exchange.status) && current_participant&.matched_participant_id == participant.id
      return participant
    end

    raise ActiveRecord::RecordNotFound
  end

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
