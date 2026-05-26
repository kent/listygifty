#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createClient } from "./client.js";

async function main() {
  const apiUrl = process.env.NIFTYGIFTY_API_URL || "http://localhost:3000";
  const apiKey = process.env.NIFTYGIFTY_API_KEY;

  if (!apiKey) {
    console.error("Error: NIFTYGIFTY_API_KEY environment variable is required");
    console.error("");
    console.error("To get an API key:");
    console.error("1. Log into Listy Gifty");
    console.error("2. Go to Settings > API Keys");
    console.error("3. Create a new API key");
    console.error("");
    console.error("Then set it in your environment:");
    console.error("  export NIFTYGIFTY_API_KEY=ng_your_key_here");
    process.exit(1);
  }

  const client = createClient({ apiUrl, apiKey });
  const server = createServer({ apiUrl, apiKey }, client);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("Listy Gifty MCP Server running on stdio");
  console.error(`API URL: ${apiUrl}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
