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

    // Route based on tool name prefix
    if (toolName.startsWith("niftygifty_") && toolName.includes("workspace")) {
      result = await handleWorkspaceTool(client, toolName, args);
    } else if (toolName.includes("holiday") || toolName.includes("template")) {
      result = await handleHolidayTool(client, toolName, args);
    } else if (
      toolName.includes("gift") &&
      !toolName.includes("suggestion") &&
      !toolName.includes("exchange")
    ) {
      result = await handleGiftTool(client, toolName, args);
    } else if (toolName.includes("person") || toolName.includes("people")) {
      result = await handlePeopleTool(client, toolName, args);
    } else if (toolName.includes("suggestion")) {
      result = await handleSuggestionTool(client, toolName, args);
    } else if (toolName.includes("exchange")) {
      result = await handleExchangeTool(client, toolName, args);
    } else if (toolName.includes("wishlist")) {
      result = await handleWishlistTool(client, toolName, args);
    } else if (toolName.includes("export")) {
      result = await handleExportTool(client, toolName, args);
    } else if (toolName.includes("status")) {
      result = await handleStatusTool(client, toolName, args);
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }

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
