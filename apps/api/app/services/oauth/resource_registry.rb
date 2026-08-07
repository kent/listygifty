module Oauth
  class ResourceRegistry
    USER_SCOPES = %w[read write].freeze
    ADMIN_SCOPES = %w[admin].freeze

    Resource = Data.define(:uri, :name, :scopes, :admin, :metadata_path)

    def initialize(base_url:)
      @base_url = base_url.delete_suffix("/")
    end

    def user_mcp
      Resource.new(
        uri: ENV.fetch("MCP_SERVER_URI") { "#{@base_url}/mcp" },
        name: "Listy Gifty MCP Server",
        scopes: USER_SCOPES,
        admin: false,
        metadata_path: "/.well-known/oauth-protected-resource/mcp"
      )
    end

    def admin_mcp
      Resource.new(
        uri: ENV.fetch("ADMIN_MCP_SERVER_URI") { "#{@base_url}/admin/mcp" },
        name: "Listy Gifty Admin MCP Server",
        scopes: ADMIN_SCOPES,
        admin: true,
        metadata_path: "/.well-known/oauth-protected-resource/admin/mcp"
      )
    end

    def find(uri)
      resources.find { |resource| resource.uri == uri }
    end

    def fetch(uri)
      resource = find(uri)
      raise OauthError.new("invalid_target", "Unknown or unsupported OAuth resource") unless resource

      resource
    end

    def resources
      [ user_mcp, admin_mcp ]
    end
  end
end
