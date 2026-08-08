import { buildMcpServerUrl, MCP_SERVER_URL } from "@/lib/mcp";

describe("MCP server URL", () => {
  it("uses the ordinary production MCP OAuth endpoint", () => {
    expect(MCP_SERVER_URL).toBe("https://api.listygifty.com/mcp");
    expect(MCP_SERVER_URL).not.toContain("/admin/mcp");
  });

  it.each([
    ["https://api.listygifty.com", "https://api.listygifty.com/mcp"],
    ["https://staging.api.listygifty.com/", "https://staging.api.listygifty.com/mcp"],
    [" http://localhost:3001/// ", "http://localhost:3001/mcp"],
  ])("builds an environment-aware endpoint from %s", (apiUrl, expected) => {
    expect(buildMcpServerUrl(apiUrl)).toBe(expected);
  });
});
