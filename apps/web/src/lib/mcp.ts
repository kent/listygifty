export const MCP_SERVER_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/mcp`
  : "https://api.listygifty.com/mcp";

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
