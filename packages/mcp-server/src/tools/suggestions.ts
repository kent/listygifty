import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";
import type { GiftSuggestion, Gift } from "../types.js";

export const suggestionTools: Tool[] = [
  {
    name: "niftygifty_generate_gift_suggestions",
    description:
      "Generate optional backup gift ideas for a person. Requires premium subscription.",
    inputSchema: {
      type: "object",
      properties: {
        person_id: {
          type: "number",
          description: "ID of the person to get suggestions for",
        },
      },
      required: ["person_id"],
    },
  },
  {
    name: "niftygifty_list_suggestions",
    description: "List existing gift suggestions for a person.",
    inputSchema: {
      type: "object",
      properties: {
        person_id: {
          type: "number",
          description: "ID of the person",
        },
      },
      required: ["person_id"],
    },
  },
  {
    name: "niftygifty_refine_suggestions",
    description:
      "Refine existing suggestions for a specific holiday context. Premium feature.",
    inputSchema: {
      type: "object",
      properties: {
        person_id: {
          type: "number",
          description: "ID of the person",
        },
        suggestion_ids: {
          type: "array",
          items: { type: "number" },
          description: "IDs of suggestions to refine",
        },
        holiday_id: {
          type: "number",
          description: "Target holiday for refinement",
        },
      },
      required: ["person_id", "suggestion_ids", "holiday_id"],
    },
  },
  {
    name: "niftygifty_accept_suggestion",
    description: "Accept a suggestion and convert it into an actual gift.",
    inputSchema: {
      type: "object",
      properties: {
        suggestion_id: {
          type: "number",
          description: "ID of the suggestion to accept",
        },
        holiday_id: {
          type: "number",
          description: "Holiday to add the gift to (optional)",
        },
      },
      required: ["suggestion_id"],
    },
  },
  {
    name: "niftygifty_dismiss_suggestion",
    description: "Dismiss a suggestion without creating a gift.",
    inputSchema: {
      type: "object",
      properties: {
        suggestion_id: {
          type: "number",
          description: "ID of the suggestion to dismiss",
        },
      },
      required: ["suggestion_id"],
    },
  },
];

export async function handleSuggestionTool(
  client: ApiClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "niftygifty_generate_gift_suggestions": {
      const personId = args.person_id as number;
      const suggestions = await client.post<GiftSuggestion[]>(
        `/people/${personId}/gift_suggestions`
      );
      return {
        message: `Generated ${suggestions.length} gift suggestions`,
        suggestions,
      };
    }

    case "niftygifty_list_suggestions": {
      const personId = args.person_id as number;
      const suggestions = await client.get<GiftSuggestion[]>(
        `/people/${personId}/gift_suggestions`
      );
      return suggestions;
    }

    case "niftygifty_refine_suggestions": {
      const personId = args.person_id as number;
      const suggestionIds = args.suggestion_ids as number[];
      const holidayId = args.holiday_id as number;

      const suggestions = await client.post<GiftSuggestion[]>(
        `/people/${personId}/gift_suggestions/refine`,
        {
          suggestion_ids: suggestionIds,
          holiday_id: holidayId,
        }
      );
      return {
        message: `Refined ${suggestions.length} suggestions for the holiday`,
        suggestions,
      };
    }

    case "niftygifty_accept_suggestion": {
      const suggestionId = args.suggestion_id as number;
      const body: Record<string, unknown> = {};
      if (args.holiday_id) {
        body.holiday_id = args.holiday_id;
      }

      const gift = await client.post<Gift>(
        `/gift_suggestions/${suggestionId}/accept`,
        body
      );
      return {
        message: `Created gift from suggestion: ${gift.name}`,
        gift,
      };
    }

    case "niftygifty_dismiss_suggestion": {
      const suggestionId = args.suggestion_id as number;
      await client.delete(`/gift_suggestions/${suggestionId}`);
      return {
        message: "Suggestion dismissed",
      };
    }

    default:
      throw new Error(`Unknown suggestion tool: ${toolName}`);
  }
}
