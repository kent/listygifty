const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.listygifty.com").replace(/\/+$/, "");

export const MCP_SERVER_URL = `${API_BASE_URL}/mcp`;

export const RUNNER_MCP_CONFIG = `{
  "mcpServers": {
    "listygifty": {
      "type": "http",
      "url": "${MCP_SERVER_URL}",
      "headers": {
        "Authorization": "Bearer ng_your_actual_api_key"
      }
    }
  }
}`;
