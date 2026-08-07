module McpTransportSecurity
  extend ActiveSupport::Concern

  SUPPORTED_PROTOCOL_VERSIONS = %w[2025-06-18 2025-03-26 2024-11-05].freeze

  private

  def validate_mcp_protocol_version!
    version = request.headers["MCP-Protocol-Version"]
    return if version.blank? || SUPPORTED_PROTOCOL_VERSIONS.include?(version)

    render json: {
      jsonrpc: "2.0",
      id: nil,
      error: { code: -32600, message: "Unsupported MCP-Protocol-Version" }
    }, status: :bad_request
  end
end
