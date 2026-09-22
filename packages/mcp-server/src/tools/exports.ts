import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";

export const exportTools: Tool[] = [
  {
    name: "niftygifty_export_gifts_csv",
    description: "Export gifts from a holiday as CSV data.",
    inputSchema: {
      type: "object",
      properties: {
        holiday_id: {
          type: "number",
          description: "The holiday ID to export gifts from",
        },
      },
      required: ["holiday_id"],
    },
  },
  {
    name: "niftygifty_export_people_csv",
    description: "Export all people in the workspace as CSV data.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export async function handleExportTool(
  client: ApiClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "niftygifty_export_gifts_csv": {
      const holidayId = args.holiday_id as number;
      const csvData = await client.getText(
        `/exports/gifts?holiday_id=${holidayId}`
      );
      return {
        message: "Gifts exported successfully",
        format: "csv",
        data: csvData,
      };
    }

    case "niftygifty_export_people_csv": {
      const csvData = await client.getText("/exports/people");
      return {
        message: "People exported successfully",
        format: "csv",
        data: csvData,
      };
    }

    default:
      throw new Error(`Unknown export tool: ${toolName}`);
  }
}
