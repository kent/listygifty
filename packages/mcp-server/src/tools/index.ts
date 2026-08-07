import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";
import { workspaceTools, handleWorkspaceTool } from "./workspaces.js";
import { holidayTools, handleHolidayTool } from "./holidays.js";
import { giftTools, handleGiftTool } from "./gifts.js";
import { peopleTools, handlePeopleTool } from "./people.js";
import { suggestionTools, handleSuggestionTool } from "./suggestions.js";
import { wishlistTools, handleWishlistTool } from "./wishlists.js";
import { exchangeTools, handleExchangeTool } from "./exchanges.js";
import { exportTools, handleExportTool } from "./exports.js";
import { statusTools, handleStatusTool } from "./statuses.js";

type ToolHandler = (
  client: ApiClient,
  toolName: string,
  args: Record<string, unknown>
) => Promise<unknown>;

export const toolGroups: ReadonlyArray<readonly [readonly Tool[], ToolHandler]> = [
  [workspaceTools, handleWorkspaceTool],
  [holidayTools, handleHolidayTool],
  [giftTools, handleGiftTool],
  [peopleTools, handlePeopleTool],
  [suggestionTools, handleSuggestionTool],
  [wishlistTools, handleWishlistTool],
  [exchangeTools, handleExchangeTool],
  [exportTools, handleExportTool],
  [statusTools, handleStatusTool],
];

export const toolHandlerRegistry: ReadonlyMap<string, ToolHandler> = (() => {
  const registry = new Map<string, ToolHandler>();
  for (const [tools, handler] of toolGroups) {
    for (const tool of tools) {
      if (registry.has(tool.name)) {
        throw new Error(`Duplicate MCP tool name: ${tool.name}`);
      }
      registry.set(tool.name, handler);
    }
  }
  return registry;
})();

// Combine all tools
export const allTools: Tool[] = [
  ...workspaceTools,
  ...holidayTools,
  ...giftTools,
  ...peopleTools,
  ...suggestionTools,
  ...wishlistTools,
  ...exchangeTools,
  ...exportTools,
  ...statusTools,
];

// Route tool calls to appropriate handlers
export async function handleToolCall(
  client: ApiClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    let result: unknown;

    const handler = toolHandlerRegistry.get(toolName);
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    result = await handler(client, toolName, args);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
