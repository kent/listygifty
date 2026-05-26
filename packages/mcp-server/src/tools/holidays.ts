import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";
import type { Holiday, Gift } from "../types.js";

interface HolidayWithGifts extends Holiday {
  gifts: Gift[];
}

interface ShareLinkResponse {
  share_token: string;
  share_url: string;
}

export const holidayTools: Tool[] = [
  {
    name: "niftygifty_list_holidays",
    description:
      "List all holidays (gift lists) in the current workspace. Shows name, date, completion status.",
    inputSchema: {
      type: "object",
      properties: {
        include_archived: {
          type: "boolean",
          description: "Include archived holidays (default: false)",
        },
      },
      required: [],
    },
  },
  {
    name: "niftygifty_get_holiday",
    description: "Get details of a specific holiday including all its gifts.",
    inputSchema: {
      type: "object",
      properties: {
        holiday_id: {
          type: "number",
          description: "The holiday ID",
        },
      },
      required: ["holiday_id"],
    },
  },
  {
    name: "niftygifty_create_holiday",
    description: "Create a new holiday/gift list for tracking gifts.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the holiday (e.g., 'Christmas 2026')",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format (optional)",
        },
        icon: {
          type: "string",
          description:
            "Lucide icon name (e.g., 'gift', 'tree', 'cake') - optional",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "niftygifty_update_holiday",
    description: "Update an existing holiday's details.",
    inputSchema: {
      type: "object",
      properties: {
        holiday_id: {
          type: "number",
          description: "The holiday ID to update",
        },
        name: {
          type: "string",
          description: "New name",
        },
        date: {
          type: "string",
          description: "New date in YYYY-MM-DD format",
        },
        icon: {
          type: "string",
          description: "New Lucide icon name",
        },
        completed: {
          type: "boolean",
          description: "Mark as completed",
        },
        archived: {
          type: "boolean",
          description: "Archive the holiday",
        },
      },
      required: ["holiday_id"],
    },
  },
  {
    name: "niftygifty_delete_holiday",
    description: "Delete a holiday. Must be the owner.",
    inputSchema: {
      type: "object",
      properties: {
        holiday_id: {
          type: "number",
          description: "The holiday ID to delete",
        },
      },
      required: ["holiday_id"],
    },
  },
  {
    name: "niftygifty_get_holiday_templates",
    description:
      "Get predefined holiday templates (Christmas, Birthday, etc.) that can be used as starting points.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "niftygifty_share_holiday",
    description:
      "Generate or get the share link for a holiday. Others can join as collaborators.",
    inputSchema: {
      type: "object",
      properties: {
        holiday_id: {
          type: "number",
          description: "The holiday ID",
        },
      },
      required: ["holiday_id"],
    },
  },
  {
    name: "niftygifty_join_holiday",
    description: "Join a shared holiday using its share token.",
    inputSchema: {
      type: "object",
      properties: {
        share_token: {
          type: "string",
          description: "The share token from the holiday share link",
        },
      },
      required: ["share_token"],
    },
  },
];

export async function handleHolidayTool(
  client: ApiClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "niftygifty_list_holidays": {
      const holidays = await client.get<Holiday[]>("/holidays");
      const includeArchived = args.include_archived as boolean | undefined;
      if (includeArchived) {
        return holidays;
      }
      return holidays.filter((h) => !h.archived);
    }

    case "niftygifty_get_holiday": {
      const holidayId = args.holiday_id as number;
      const holiday = await client.get<HolidayWithGifts>(
        `/holidays/${holidayId}`
      );
      return holiday;
    }

    case "niftygifty_create_holiday": {
      const holiday = await client.post<Holiday>("/holidays", {
        holiday: {
          name: args.name,
          date: args.date,
          icon: args.icon,
        },
      });
      return {
        message: `Created holiday: ${holiday.name}`,
        holiday,
      };
    }

    case "niftygifty_update_holiday": {
      const holidayId = args.holiday_id as number;
      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.date !== undefined) updateData.date = args.date;
      if (args.icon !== undefined) updateData.icon = args.icon;
      if (args.completed !== undefined) updateData.completed = args.completed;
      if (args.archived !== undefined) updateData.archived = args.archived;

      const holiday = await client.patch<Holiday>(`/holidays/${holidayId}`, {
        holiday: updateData,
      });
      return {
        message: `Updated holiday: ${holiday.name}`,
        holiday,
      };
    }

    case "niftygifty_delete_holiday": {
      const holidayId = args.holiday_id as number;
      await client.delete(`/holidays/${holidayId}`);
      return {
        message: "Holiday deleted successfully",
      };
    }

    case "niftygifty_get_holiday_templates": {
      const templates = await client.get<Holiday[]>("/holidays/templates");
      return templates;
    }

    case "niftygifty_share_holiday": {
      const holidayId = args.holiday_id as number;
      const result = await client.post<ShareLinkResponse>(
        `/holidays/${holidayId}/share`
      );
      return {
        message: "Share link generated",
        share_url: result.share_url,
        share_token: result.share_token,
      };
    }

    case "niftygifty_join_holiday": {
      const shareToken = args.share_token as string;
      const holiday = await client.post<Holiday>("/holidays/join", {
        share_token: shareToken,
      });
      return {
        message: `Joined holiday: ${holiday.name}`,
        holiday,
      };
    }

    default:
      throw new Error(`Unknown holiday tool: ${toolName}`);
  }
}
