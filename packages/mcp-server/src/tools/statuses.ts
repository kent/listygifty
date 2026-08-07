import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";
import type { GiftStatus } from "../types.js";

export const statusTools: Tool[] = [
  {
    name: "niftygifty_list_gift_statuses",
    description:
      "List all available gift statuses (Idea, Purchased, Wrapped, etc.).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
];

export async function handleStatusTool(
  client: ApiClient,
  toolName: string,
  _args: Record<string, unknown>
): Promise<unknown> {
  if (toolName !== "niftygifty_list_gift_statuses") {
    throw new Error(`Unknown status tool: ${toolName}`);
  }

  return client.get<GiftStatus[]>("/gift_statuses");
}
