import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";
import type {
  GiftExchange,
  GiftExchangeWithParticipants,
  ExchangeParticipant,
  ExchangeExclusion,
} from "../types.js";

export const exchangeTools: Tool[] = [
  {
    name: "niftygifty_list_gift_exchanges",
    description: "List all gift exchanges the user participates in.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "inviting", "active", "completed"],
          description: "Filter by exchange status",
        },
      },
      required: [],
    },
  },
  {
    name: "niftygifty_get_gift_exchange",
    description:
      "Get details of a gift exchange including participants and their statuses.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
      },
      required: ["exchange_id"],
    },
  },
  {
    name: "niftygifty_create_gift_exchange",
    description: "Create a new gift exchange (Secret Santa style).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Exchange name (e.g., 'Family Secret Santa 2026')",
        },
        exchange_date: {
          type: "string",
          description: "Date of the exchange in YYYY-MM-DD format",
        },
        budget_min: {
          type: "number",
          description: "Minimum budget per gift",
        },
        budget_max: {
          type: "number",
          description: "Maximum budget per gift",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "niftygifty_update_gift_exchange",
    description: "Update a gift exchange's details.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
        name: {
          type: "string",
          description: "New name",
        },
        exchange_date: {
          type: "string",
          description: "New date",
        },
        budget_min: {
          type: "number",
          description: "New minimum budget",
        },
        budget_max: {
          type: "number",
          description: "New maximum budget",
        },
      },
      required: ["exchange_id"],
    },
  },
  {
    name: "niftygifty_delete_gift_exchange",
    description: "Delete a gift exchange. Must be the owner.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID to delete",
        },
      },
      required: ["exchange_id"],
    },
  },
  {
    name: "niftygifty_add_exchange_participant",
    description: "Add a participant to a gift exchange. They will receive an invite.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
        name: {
          type: "string",
          description: "Participant's name",
        },
        email: {
          type: "string",
          description: "Participant's email (for invite)",
        },
      },
      required: ["exchange_id", "name", "email"],
    },
  },
  {
    name: "niftygifty_remove_exchange_participant",
    description: "Remove a participant from a gift exchange.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
        participant_id: {
          type: "number",
          description: "The participant ID to remove",
        },
      },
      required: ["exchange_id", "participant_id"],
    },
  },
  {
    name: "niftygifty_resend_exchange_invite",
    description: "Resend the invitation email to a participant.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
        participant_id: {
          type: "number",
          description: "The participant ID",
        },
      },
      required: ["exchange_id", "participant_id"],
    },
  },
  {
    name: "niftygifty_add_exchange_exclusion",
    description:
      "Add an exclusion rule preventing two people from being matched together.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
        participant_a_id: {
          type: "number",
          description: "First participant ID",
        },
        participant_b_id: {
          type: "number",
          description: "Second participant ID",
        },
      },
      required: ["exchange_id", "participant_a_id", "participant_b_id"],
    },
  },
  {
    name: "niftygifty_remove_exchange_exclusion",
    description: "Remove an exclusion rule.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
        exclusion_id: {
          type: "number",
          description: "The exclusion ID to remove",
        },
      },
      required: ["exchange_id", "exclusion_id"],
    },
  },
  {
    name: "niftygifty_list_exchange_exclusions",
    description: "List all exclusion rules for an exchange.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
      },
      required: ["exchange_id"],
    },
  },
  {
    name: "niftygifty_start_exchange_matching",
    description:
      "Start the matching process. All participants will be assigned who to give a gift to.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
      },
      required: ["exchange_id"],
    },
  },
  {
    name: "niftygifty_get_my_match",
    description: "Get who I'm matched to give a gift to in an exchange.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "number",
          description: "The exchange ID",
        },
      },
      required: ["exchange_id"],
    },
  },
];

export async function handleExchangeTool(
  client: ApiClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "niftygifty_list_gift_exchanges": {
      let endpoint = "/gift_exchanges";
      if (args.status) {
        endpoint += `?status=${args.status}`;
      }
      const exchanges = await client.get<GiftExchange[]>(endpoint);
      return exchanges;
    }

    case "niftygifty_get_gift_exchange": {
      const exchangeId = args.exchange_id as number;
      const exchange = await client.get<GiftExchangeWithParticipants>(
        `/gift_exchanges/${exchangeId}`
      );
      return exchange;
    }

    case "niftygifty_create_gift_exchange": {
      const exchangeData: Record<string, unknown> = {
        name: args.name,
      };
      if (args.exchange_date) exchangeData.exchange_date = args.exchange_date;
      if (args.budget_min) exchangeData.budget_min = args.budget_min;
      if (args.budget_max) exchangeData.budget_max = args.budget_max;

      const exchange = await client.post<GiftExchange>("/gift_exchanges", {
        gift_exchange: exchangeData,
      });
      return {
        message: `Created gift exchange: ${exchange.name}`,
        exchange,
      };
    }

    case "niftygifty_update_gift_exchange": {
      const exchangeId = args.exchange_id as number;
      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.exchange_date !== undefined)
        updateData.exchange_date = args.exchange_date;
      if (args.budget_min !== undefined) updateData.budget_min = args.budget_min;
      if (args.budget_max !== undefined) updateData.budget_max = args.budget_max;

      const exchange = await client.patch<GiftExchange>(
        `/gift_exchanges/${exchangeId}`,
        { gift_exchange: updateData }
      );
      return {
        message: `Updated exchange: ${exchange.name}`,
        exchange,
      };
    }

    case "niftygifty_delete_gift_exchange": {
      const exchangeId = args.exchange_id as number;
      await client.delete(`/gift_exchanges/${exchangeId}`);
      return {
        message: "Gift exchange deleted successfully",
      };
    }

    case "niftygifty_add_exchange_participant": {
      const exchangeId = args.exchange_id as number;
      const participant = await client.post<ExchangeParticipant>(
        `/gift_exchanges/${exchangeId}/exchange_participants`,
        {
          exchange_participant: {
            name: args.name,
            email: args.email,
          },
        }
      );
      return {
        message: `Added participant: ${participant.name}`,
        participant,
      };
    }

    case "niftygifty_remove_exchange_participant": {
      const exchangeId = args.exchange_id as number;
      const participantId = args.participant_id as number;
      await client.delete(
        `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}`
      );
      return {
        message: "Participant removed successfully",
      };
    }

    case "niftygifty_resend_exchange_invite": {
      const exchangeId = args.exchange_id as number;
      const participantId = args.participant_id as number;
      await client.post(
        `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/resend_invite`
      );
      return {
        message: "Invitation resent successfully",
      };
    }

    case "niftygifty_add_exchange_exclusion": {
      const exchangeId = args.exchange_id as number;
      const exclusion = await client.post<ExchangeExclusion>(
        `/gift_exchanges/${exchangeId}/exchange_exclusions`,
        {
          exchange_exclusion: {
            participant_a_id: args.participant_a_id,
            participant_b_id: args.participant_b_id,
          },
        }
      );
      return {
        message: `Added exclusion: ${exclusion.participant_a.name} <-> ${exclusion.participant_b.name}`,
        exclusion,
      };
    }

    case "niftygifty_remove_exchange_exclusion": {
      const exchangeId = args.exchange_id as number;
      const exclusionId = args.exclusion_id as number;
      await client.delete(
        `/gift_exchanges/${exchangeId}/exchange_exclusions/${exclusionId}`
      );
      return {
        message: "Exclusion removed successfully",
      };
    }

    case "niftygifty_list_exchange_exclusions": {
      const exchangeId = args.exchange_id as number;
      const exclusions = await client.get<ExchangeExclusion[]>(
        `/gift_exchanges/${exchangeId}/exchange_exclusions`
      );
      return exclusions;
    }

    case "niftygifty_start_exchange_matching": {
      const exchangeId = args.exchange_id as number;
      const exchange = await client.post<GiftExchangeWithParticipants>(
        `/gift_exchanges/${exchangeId}/start`
      );
      return {
        message: `Matching complete! ${exchange.participant_count} participants have been assigned.`,
        exchange,
      };
    }

    case "niftygifty_get_my_match": {
      const exchangeId = args.exchange_id as number;
      const exchange = await client.get<GiftExchange>(
        `/gift_exchanges/${exchangeId}`
      );

      if (!exchange.my_participant?.matched_participant) {
        return {
          message:
            "You haven't been matched yet. The exchange may still be in draft status.",
          matched: false,
        };
      }

      return {
        message: `You are giving a gift to: ${exchange.my_participant.matched_participant.display_name}`,
        matched: true,
        recipient: exchange.my_participant.matched_participant,
      };
    }

    default:
      throw new Error(`Unknown exchange tool: ${toolName}`);
  }
}
