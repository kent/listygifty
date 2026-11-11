# MCP (Model Context Protocol) HTTP endpoint
# Implements Streamable HTTP transport for remote MCP connections
class McpController < ApplicationController
  include OauthTokenAuthenticatable
  include McpTransportSecurity

  SUPPORTED_PROTOCOL_VERSIONS = McpTransportSecurity::SUPPORTED_PROTOCOL_VERSIONS
  MAX_REQUEST_BYTES = 256.kilobytes
  MAX_JSON_DEPTH = 32
  MAX_METHOD_LENGTH = 100

  # Tool annotations tell clients such as ChatGPT which calls need the user's
  # confirmation. Read-scoped tools are read-only. Write tools that overwrite,
  # remove, or irreversibly change data are destructive.
  DESTRUCTIVE_TOOLS = %w[
    decline_exchange_invite publish_gift_exchange redo_gift_exchange revoke_wishlist_share
    start_gift_exchange unclaim_wishlist_item
  ].freeze
  DESTRUCTIVE_PREFIXES = %w[delete_ remove_ update_].freeze
  # Tools that reach people outside the user's account: emails to arbitrary
  # addresses, public links anyone can open, or wishlist content that shows
  # on those public links.
  OPEN_WORLD_TOOLS = %w[
    add_exchange_participant create_gift_exchange create_wishlist_item delete_gift_exchange nudge_exchange_match
    publish_gift_exchange redo_gift_exchange resend_exchange_invite share_wishlist start_gift_exchange
    update_wishlist update_wishlist_item
  ].freeze

  skip_before_action :authenticate!
  before_action :set_security_headers
  before_action :validate_origin!
  # Authenticate first: clients probe with a bare POST and expect a 401 whose
  # WWW-Authenticate header points them at OAuth discovery.
  before_action :authenticate_oauth_or_api_key!
  before_action :validate_content_type!, only: :handle
  before_action :validate_mcp_protocol_version!
  after_action :set_security_headers

  # Streamable HTTP GET is optional. This stateless server has no server-
  # initiated messages, so holding Puma threads open for SSE is unsafe.
  def connect
    response.headers["Allow"] = "POST"
    head :method_not_allowed
  end

  # POST /mcp
  # Main MCP endpoint - handles JSON-RPC messages
  def handle
    raw_body = bounded_request_body
    return if performed?

    body = JSON.parse(raw_body, max_nesting: MAX_JSON_DEPTH)
    if body.is_a?(Array)
      render json: jsonrpc_error(nil, -32600, "Batch requests are not supported"), status: :bad_request
    else
      response = process_jsonrpc_request(body)
      response ? render(json: response) : head(:accepted)
    end
  rescue JSON::ParserError, JSON::NestingError
    render_jsonrpc_error(nil, -32700, "Parse error")
  end

  private

  def validate_content_type!
    return if request.media_type == "application/json"

    render json: { error: "Content-Type must be application/json" }, status: :unsupported_media_type
  end

  def validate_origin!
    origin = request.headers["Origin"]
    return if origin.blank?

    allowed = ENV.fetch("MCP_ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:blank?)
    render json: { error: "Origin is not allowed for the MCP" }, status: :forbidden unless allowed.include?(origin)
  end

  def set_security_headers
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
  end

  def authenticate_oauth_or_api_key!
    if authenticate_with_oauth_token || authenticate_with_api_key
      return true unless DemoAccount.user?(@current_user) && !demo_account_allowed?

      render json: { error: "forbidden", error_description: "The demo account can only use the Listy Gifty app in ChatGPT" }, status: :forbidden
      return false
    end

    # Return 401 with WWW-Authenticate header per RFC 9728
    response.headers["WWW-Authenticate"] = %(Bearer resource_metadata="#{resource_metadata_url}", scope="read write")
    render json: { error: "unauthorized", error_description: "Valid OAuth token or API key required" }, status: :unauthorized
    false
  end

  def authenticate_with_oauth_token
    token = extract_bearer_token
    return false unless token

    return false if token.start_with?("ng_") # This is an API key, not OAuth
    return false unless OauthAccessToken.hardened_access_token?(token)

    oauth_token = OauthAccessToken.find_by_token(token)
    return false unless oauth_token

    # OAuth access tokens are sender-constrained to this exact protected
    # resource through the RFC 8707 resource indicator.
    return false unless oauth_token.resource == oauth_resource.uri
    return false if oauth_token.scopes.empty? || (oauth_token.scopes - oauth_resource.scopes).any?

    oauth_token.touch_last_used!
    @current_user = oauth_token.user
    @current_oauth_token = oauth_token
    Current.user = @current_user
    true
  end

  def authenticate_with_api_key
    # Check Authorization header or X-API-Key header
    bearer_token = extract_bearer_token
    api_key_header = request.headers["X-API-Key"]

    raw_key = if bearer_token&.start_with?("ng_")
      bearer_token
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

  def bounded_request_body
    if request.content_length.to_i > MAX_REQUEST_BYTES
      render json: { error: "MCP request is too large" }, status: :content_too_large
      return nil
    end

    body = request.body.read(MAX_REQUEST_BYTES + 1)
    if body.bytesize > MAX_REQUEST_BYTES
      render json: { error: "MCP request is too large" }, status: :content_too_large
      return nil
    end
    body
  end

  def valid_jsonrpc_message?(message)
    return false unless message.is_a?(Hash)
    return false unless message["jsonrpc"] == "2.0"
    return false unless message["method"].is_a?(String) &&
      message["method"].present? && message["method"].length <= MAX_METHOD_LENGTH
    return false unless !message.key?("params") || message["params"].is_a?(Hash)
    return false unless !message.key?("id") || valid_request_id?(message["id"])

    true
  end

  def valid_request_id?(id)
    id.nil? || id.is_a?(String) || id.is_a?(Integer)
  end

  def process_jsonrpc_request(req)
    unless valid_jsonrpc_message?(req)
      candidate_id = req.is_a?(Hash) ? req["id"] : nil
      id = valid_request_id?(candidate_id) ? candidate_id : nil
      return jsonrpc_error(id, -32600, "Invalid Request")
    end

    method = req["method"]
    params = req["params"] || {}
    id = req["id"]
    is_notification = !req.key?("id")
    return nil if is_notification && method != "notifications/initialized"

    begin
      result = dispatch_method(method, params)
      is_notification ? nil : jsonrpc_response(id, result)
    rescue McpError => e
      is_notification ? nil : jsonrpc_error(id, e.code, e.message, e.data)
    rescue StandardError => e
      Rails.logger.error("MCP error request_id=#{request.request_id} class=#{e.class}")
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

    # Check scope permissions and enforce the same schema advertised to clients.
    required_scope = tool_handler[:scope] || "read"
    require_scope!(required_scope)
    Admin::Mcp::SchemaValidator.validate!(tool_args, tool_handler[:schema])

    result = tool_handler[:handler].call(tool_args)
    { content: [ { type: "text", text: result.to_json } ] }
  rescue Gifts::MutationService::LimitExceeded => e
    tool_error(e.message)
  rescue ActiveRecord::RecordInvalid => e
    tool_error(e.record.errors.full_messages.join(", "))
  rescue ActiveRecord::RecordNotFound
    tool_error("The requested record was not found or is not accessible")
  rescue ArgumentError => e
    tool_error(e.message)
  end

  def handle_list_resources(_params)
    require_scope!("read")
    { resources: mcp_resources }
  end

  def handle_read_resource(params)
    require_scope!("read")
    uri = params["uri"]
    resource = resource_handlers[uri]
    raise McpError.new(-32602, "Unknown resource: #{uri}") unless resource

    result = resource[:handler].call
    { contents: [ { uri: uri, mimeType: "application/json", text: result.to_json } ] }
  end

  def require_scope!(scope)
    return if can_access_scope?(scope)

    raise McpError.new(-32000, "Insufficient permissions. Required scope: #{scope}")
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

  # The demo account is shared, so it only gets the apps tool set.
  def demo_account_allowed?
    false
  end

  def resource_metadata_url
    "#{request.base_url}#{oauth_resource.metadata_path}"
  end

  def oauth_resource
    @oauth_resource ||= Oauth::ResourceRegistry.new(base_url: request.base_url).user_mcp
  end

  # MCP Tools and Resources definitions
  def mcp_tools
    tool_handlers.map do |name, config|
      {
        name: name,
        description: config[:description],
        inputSchema: config[:schema],
        annotations: tool_annotations(name, config)
      }
    end
  end

  def tool_annotations(name, config)
    read_only = (config[:scope] || "read") == "read"
    {
      readOnlyHint: read_only,
      destructiveHint: !read_only && (DESTRUCTIVE_TOOLS.include?(name) || name.start_with?(*DESTRUCTIVE_PREFIXES)),
      openWorldHint: OPEN_WORLD_TOOLS.include?(name)
    }
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
    @tool_handlers ||= build_tool_handlers.tap do |handlers|
      handlers.each_value do |config|
        config[:schema][:additionalProperties] = false if config.dig(:schema, :type) == "object"
      end
    end
  end

  def resource_handlers
    @resource_handlers ||= build_resource_handlers
  end

  def build_tool_handlers
    handlers = {
      # Workspace tools
      "list_workspaces" => {
        description: "List the Listy Gifty workspaces the user belongs to. Call this first to get the workspace_id that the wishlist, Gift List, and people tools need. Most people have one personal workspace.",
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
        description: "List the user's Gift Lists in a workspace. A Gift List is an occasion, such as Christmas or Mom's birthday, that holds the gifts the user plans to give.",
        scope: "read",
        schema: { type: "object", properties: { workspace_id: { type: "integer" } }, required: [ "workspace_id" ] },
        handler: ->(args) {
          workspace = find_workspace(args["workspace_id"])
          @current_user.holidays_in_workspace(workspace).map { |holiday| holiday_to_json(holiday) }
        }
      },
      "create_holiday" => {
        description: "Create a Gift List for an occasion, such as \"Christmas 2026\" or \"Dad's 60th\", with an optional date. The user becomes its owner.",
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
        description: "Get one Gift List, including its date and who it is shared with.",
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
        description: "List the gift ideas and planned gifts in a Gift List, with their recipients, givers, cost, and status.",
        scope: "read",
        schema: { type: "object", properties: { holiday_id: { type: "integer" } }, required: [ "holiday_id" ] },
        handler: ->(args) {
          holiday = find_holiday(args["holiday_id"])
          holiday.gifts.includes(:gift_recipients, :gift_givers, :gift_status).map { |g| gift_to_json(g) }
        }
      },
      "create_gift" => {
        description: "Add a gift idea to a Gift List. Use recipient_ids from list_people to say who the gift is for. If the Gift List is shared, its other members may get an email about the new gift.",
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
            recipient_ids: { type: "array", items: { type: "integer" }, maxItems: 100, uniqueItems: true },
            giver_ids: { type: "array", items: { type: "integer" }, maxItems: 100, uniqueItems: true }
          },
          required: [ "holiday_id", "name" ]
        },
        handler: ->(args) {
          gift = Gifts::MutationService.new(@current_user).create(args)
          GiftBlueprint.render_as_hash(gift.reload, current_user: @current_user)
        }
      },
      "get_gift" => {
        description: "Get one gift from a Gift List, with its recipients, givers, cost, link, and status.",
        scope: "read",
        schema: tool_schema({ gift_id: integer_property("Gift ID") }, [ "gift_id" ]),
        handler: ->(args) { GiftBlueprint.render_as_hash(find_gift(args["gift_id"]), current_user: @current_user) }
      },
      "update_gift" => {
        description: "Change a gift in a Gift List, such as its name, cost, link, status, recipients, or givers. Only the fields provided are changed.",
        scope: "write",
        schema: gift_update_schema,
        handler: ->(args) { update_gift_from_mcp(args) }
      },
      "delete_gift" => {
        description: "Remove a gift from a Gift List the user can access. This cannot be undone.",
        scope: "write",
        schema: tool_schema({ gift_id: integer_property("Gift ID") }, [ "gift_id" ]),
        handler: ->(args) {
          find_gift(args["gift_id"]).destroy!
          { deleted: true }
        }
      },

      # People tools
      "list_people" => {
        description: "List the people in a workspace that the user buys gifts for. Use their IDs as recipient_ids or giver_ids on gifts.",
        scope: "read",
        schema: { type: "object", properties: { workspace_id: { type: "integer" } }, required: [ "workspace_id" ] },
        handler: ->(args) { find_workspace(args["workspace_id"]).people.map { |p| person_to_json(p) } }
      },
      "create_person" => {
        description: "Add a person the user buys gifts for, such as a family member or friend. Only the name is required.",
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
        handler: ->(args) { serialize_person(find_person(args["person_id"])) }
      },
      "update_person" => {
        description: "Update an accessible person/contact",
        scope: "write",
        schema: person_update_schema,
        handler: ->(args) {
          person = find_person(args["person_id"])
          raise ArgumentError, "Externally shared people are read-only" unless person.editable_by?(@current_user)
          if args.key?("default_shipping_address_id") && !person.shipping_address_editable_by?(@current_user)
            raise ArgumentError, "Only workspace admins can manage shipping addresses"
          end
          person.update!(slice_args(args, person_attributes))
          serialize_person(person)
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
        description: "List the wishlists the user can see in a workspace, including their own and ones shared with them. Use this to find a wishlist_id before reading a wishlist or adding to it.",
        scope: "read",
        schema: { type: "object", properties: { workspace_id: { type: "integer" } }, required: [ "workspace_id" ] },
        handler: ->(args) {
          workspace = find_workspace(args["workspace_id"])
          Wishlist.visible_to(@current_user, workspace).map { |wishlist| wishlist_to_json(wishlist) }
        }
      }
    }

    handlers.merge(wishlist_tool_handlers).merge(exchange_tool_handlers)
  end

  def wishlist_tool_handlers
    {
      "get_wishlist" => {
        description: "Get one wishlist with all of its active items. The owner never sees what has been claimed or bought, so their surprises are not spoiled.",
        scope: "read",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) { serialize_wishlist(find_wishlist(args["wishlist_id"]), with_items: true) }
      },
      "create_wishlist" => {
        description: "Create a new wishlist owned by the user, such as a birthday or holiday wishlist. Use share_wishlist afterwards if the user wants a link to send to people.",
        scope: "write",
        schema: tool_schema({
          workspace_id: integer_property("Workspace ID"),
          name: string_property("Wishlist name"),
          description: string_property("Description"),
          visibility: enum_property(%w[private workspace shared]),
          target_date: string_property("Target date in YYYY-MM-DD format")
        }, %w[workspace_id name]),
        handler: ->(args) {
          workspace = find_workspace(args["workspace_id"])
          wishlist = workspace.wishlists.create!(
            user: @current_user,
            **slice_args(args, %w[name description visibility target_date])
          )
          serialize_wishlist(wishlist)
        }
      },
      "update_wishlist" => {
        description: "Change a wishlist the user owns: its name, description, visibility, or target date. Only the fields provided are changed.",
        scope: "write",
        schema: tool_schema({
          wishlist_id: integer_property("Wishlist ID"),
          name: string_property,
          description: string_property,
          visibility: enum_property(%w[private workspace shared]),
          target_date: string_property("Target date in YYYY-MM-DD format")
        }, [ "wishlist_id" ]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          wishlist.update!(slice_args(args, %w[name description visibility target_date]))
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
        description: "Get the public share link for a wishlist the user owns, creating one if it is not shared yet. Anyone with the link can see the wishlist and claim items. A link that is already live is returned unchanged, so links already sent keep working.",
        scope: "write",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          wishlist.ensure_share_link!
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
      "list_wishlist_items" => {
        description: "List the active items on a wishlist the user can see, in the owner's order of preference.",
        scope: "read",
        schema: tool_schema({ wishlist_id: integer_property("Wishlist ID") }, [ "wishlist_id" ]),
        handler: ->(args) { serialize_wishlist_items(find_wishlist(args["wishlist_id"]).wishlist_items.active.ordered) }
      },
      "create_wishlist_item" => {
        description: "Add an item to a wishlist the user owns, for example when they say \"add noise-cancelling headphones to my birthday wishlist\". Include a product URL, price range, priority, or quantity when the user gives one. Anyone the wishlist is shared with will see the new item.",
        scope: "write",
        schema: wishlist_item_schema(required: %w[wishlist_id name]),
        handler: ->(args) {
          wishlist = find_owned_wishlist(args["wishlist_id"])
          item = wishlist.wishlist_items.create!(slice_args(args, wishlist_item_attributes))
          ExchangeNotificationService.wishlist_item_added!(item)
          serialize_wishlist_item(item)
        }
      },
      "update_wishlist_item" => {
        description: "Change an item on a wishlist the user owns, such as its name, notes, link, price range, priority, or quantity. Only the fields provided are changed.",
        scope: "write",
        schema: wishlist_item_schema(required: %w[wishlist_id item_id], include_item_id: true),
        handler: ->(args) {
          item = find_owned_wishlist(args["wishlist_id"]).wishlist_items.find(args["item_id"])
          item.update!(slice_args(args, wishlist_item_attributes))
          serialize_wishlist_item(item)
        }
      },
      "delete_wishlist_item" => {
        description: "Remove an item from a wishlist the user owns, along with any claims on it. This cannot be undone.",
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
        description: "List the gift exchanges, such as a Secret Santa, that the user organizes or has joined. Each one includes my_participant, whose id is the participant_id the exchange wishlist tools need.",
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
            raise ArgumentError, "Names have already been drawn for this exchange" unless participant.gift_exchange.status == "inviting"
            raise ArgumentError, "This invite has already been accepted" if participant.status == "accepted"
            raise ArgumentError, "This invite has been declined" if participant.status == "declined"
            participant.accept!(@current_user)
          end
          ExchangeNotificationService.invite_accepted!(participant)
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
            raise ArgumentError, "Names have already been drawn for this exchange" unless participant.gift_exchange.status == "inviting"
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
        description: "Get the person the user is giving to in a gift exchange, after names are drawn, along with that person's exchange wishlist.",
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
        description: "List a participant's wishlist for a gift exchange. The user can read their own, and after names are drawn, the wishlist of the person they are giving to.",
        scope: "read",
        schema: participant_reference_schema,
        handler: ->(args) {
          participant = find_exchange_participant_for_wishlist(args)
          ExchangeWishlistItemBlueprint.render_as_hash(participant.wishlist_items, participant_id: participant.id)
        }
      },
      "create_exchange_wishlist_item" => {
        description: "Add a gift idea to the user's own wishlist for a gift exchange, so whoever draws their name knows what they would like. Needs the exchange_id and the user's own participant_id from list_gift_exchanges. Once names are drawn, their giver sees a notification about the new idea.",
        scope: "write",
        schema: exchange_wishlist_item_schema(required: %w[exchange_id participant_id name]),
        handler: ->(args) {
          participant = find_owned_exchange_participant(args)
          item = participant.wishlist!.wishlist_items.create!(exchange_wishlist_item_attributes(args))
          ExchangeNotificationService.wishlist_item_added!(item)
          ExchangeWishlistItemBlueprint.render_as_hash(item, participant_id: participant.id)
        }
      },
      "update_exchange_wishlist_item" => {
        description: "Change an item on the user's own gift exchange wishlist. Only the fields provided are changed.",
        scope: "write",
        schema: exchange_wishlist_item_schema(required: %w[exchange_id participant_id item_id], include_item_id: true),
        handler: ->(args) {
          participant = find_owned_exchange_participant(args)
          item = participant.wishlist_items.find(args["item_id"])
          item.update!(exchange_wishlist_item_attributes(args))
          ExchangeWishlistItemBlueprint.render_as_hash(item, participant_id: participant.id)
        }
      },
      "delete_exchange_wishlist_item" => {
        description: "Remove an item from the user's own gift exchange wishlist. This cannot be undone.",
        scope: "write",
        schema: tool_schema({
          exchange_id: id_property("Gift exchange ID or slug"),
          participant_id: integer_property("Participant ID"),
          item_id: integer_property("Exchange wishlist item ID")
        }, %w[exchange_id participant_id item_id]),
        handler: ->(args) {
          find_owned_exchange_participant(args).wishlist_items.find(args["item_id"]).destroy!
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
          upcoming_holidays = workspaces.flat_map do |workspace|
            @current_user.holidays_in_workspace(workspace)
              .where("date >= ?", Date.current).order(:date).limit(5)
          end
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
            is_premium: @current_user.premium?,
            subscription_status: @current_user.subscription_status
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
      recipient_ids: { type: "array", items: { type: "integer" }, maxItems: 100, uniqueItems: true },
      giver_ids: { type: "array", items: { type: "integer" }, maxItems: 100, uniqueItems: true }
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

  # Exchange tools speak description, link and one price. Wishlist items
  # store notes, url and a range, so one price fills both ends.
  def exchange_wishlist_item_attributes(args)
    given = slice_args(args, %w[name description link price])
    attributes = given.slice(:name)
    attributes[:notes] = given[:description] if given.key?(:description)
    attributes[:url] = given[:link] if given.key?(:link)
    attributes[:price_min] = attributes[:price_max] = given[:price] if given.key?(:price)
    attributes
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
    Gifts::MutationService.new(@current_user).update(gift, args.except("gift_id"))
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

    claim = Wishlists::ClaimService.create!(
      item: item, user: @current_user,
      quantity: args.fetch("quantity", 1), purchased: args["purchased"]
    )
    WishlistItemClaimBlueprint.render_as_hash(claim)
  end

  def accessible_exchanges
    GiftExchange.for_user(@current_user)
                .includes(exchange_participants: [ :matched_participant, :wishlist, :wishlist_items ])
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
    raise ArgumentError, "An exchange can't be changed after names are drawn" unless exchange.editable?

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

  def serialize_person(person)
    visible_workspace = person.workspace if person.workspace.member?(@current_user)
    PersonBlueprint.render_as_hash(
      person,
      current_user: @current_user,
      current_workspace: visible_workspace
    )
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
